import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proving that a webhook really came from Stripe.
 *
 * ## Why this is the most important file in the payment path
 *
 * The endpoint this guards marks our invoices **paid**. It is a public URL — it has to be, Stripe is
 * a server with no session — so without a signature check it is an unauthenticated write that says
 * "this customer has paid us", and anyone who guesses the path can clear their own bill. Every other
 * part of taking a payment can fail loudly; this one fails silently and in the customer's favour.
 *
 * So: **an event is not an event until it verifies.** Nothing downstream reads a field of the body
 * before `verifyStripeSignature` has returned ok, and an unverifiable request is refused rather than
 * logged-and-accepted.
 *
 * ## The scheme, and the two things people get wrong
 *
 * Stripe sends `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>…]`, where the signed payload is
 * literally `${t}.${rawBody}` and the MAC is HMAC-SHA256 under the endpoint's `whsec_…` secret.
 *
 * 1. **It must be the RAW body.** `JSON.parse` then `JSON.stringify` changes key order and
 *    whitespace, and the signature is over bytes. A route that reads `await req.json()` has already
 *    destroyed the thing it needs to check, and the failure looks like "Stripe keeps sending bad
 *    signatures" rather than like our bug.
 * 2. **The timestamp is part of the security, not metadata.** Without a tolerance, a signature
 *    stays valid forever, so anyone who ever captures one valid "invoice paid" event can replay it
 *    whenever they like. Five minutes is Stripe's own recommendation.
 *
 * Comparison is `timingSafeEqual`, for the same reason every other secret comparison in this
 * codebase is: a byte-at-a-time compare leaks the answer to whoever is willing to measure.
 *
 * ## No Stripe SDK
 *
 * The rest of this integration talks to Stripe over `fetch`, and pulling in the SDK for one HMAC
 * would add a dependency to the deploy for something Node's own crypto does in ten lines — ten lines
 * that can then be tested against a forged signature, which is the test that actually matters.
 */

/** Stripe's own recommended tolerance. Older than this and a captured event cannot be replayed. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureResult =
  | { ok: true }
  /** Every refusal names its reason — the endpoint logs it and returns 400, and it is how a
   *  misconfigured secret is told apart from an attack in the one place that can tell. */
  | { ok: false; reason: string };

interface ParsedHeader {
  timestamp: number | null;
  signatures: string[];
}

/**
 * Read `t=` and every `v1=` out of the header.
 *
 * Several `v1` values are normal and not suspicious: during a secret rotation Stripe signs with both,
 * so accepting any match is what lets a secret be rotated without dropping events. Unknown schemes
 * (`v0`, and whatever comes next) are ignored rather than rejected.
 */
export function parseSignatureHeader(header: string): ParsedHeader {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const n = Number(value);
      if (Number.isFinite(n)) timestamp = n;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
}

function hexEqual(a: string, b: string): boolean {
  // Different lengths cannot match, and `timingSafeEqual` throws on mismatched buffers — so the
  // length check is required, not an optimisation. Length is not the secret; the bytes are.
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false; // not valid hex
  }
}

/**
 * Verify one raw body against one endpoint secret.
 *
 * `nowSeconds` is injectable so the replay window can actually be tested. A tolerance nobody has
 * watched reject an old event is a tolerance nobody knows is wired up.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignatureResult {
  if (!header) return { ok: false, reason: "No Stripe-Signature header." };
  if (!secret) return { ok: false, reason: "No webhook signing secret is configured for this mode." };

  const { timestamp, signatures } = parseSignatureHeader(header);
  if (timestamp === null) return { ok: false, reason: "Signature header carries no timestamp." };
  if (signatures.length === 0) return { ok: false, reason: "Signature header carries no v1 signature." };

  /*
   * Checked BEFORE the MAC, deliberately.
   *
   * A stale event has a perfectly valid signature — that is exactly what makes replay possible — so
   * the age has to be its own gate rather than something considered afterwards. Future timestamps
   * are rejected by the same absolute comparison: a clock far ahead is either broken or chosen.
   */
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: `Signature timestamp is outside the ${SIGNATURE_TOLERANCE_SECONDS}s tolerance — a replayed or badly-clocked request.` };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return signatures.some((s) => hexEqual(s, expected))
    ? { ok: true }
    : { ok: false, reason: "Signature does not match. The body was altered in transit, or this endpoint's secret is not the one Stripe is signing with." };
}

/**
 * Verify against every secret we hold, and report WHICH mode signed it.
 *
 * Test and live are separate Stripe accounts with separate endpoints and separate secrets, and both
 * may be configured at once. Which one signed is not something to read out of the body — the body is
 * not trustworthy until something has verified it — so it is the successful verification itself that
 * decides. That is the only ordering that cannot be lied to.
 */
export function verifyAgainstModes(
  rawBody: string,
  header: string | null,
  secrets: { mode: "test" | "live"; secret: string }[],
  nowSeconds?: number,
): { ok: true; mode: "test" | "live" } | { ok: false; reason: string } {
  if (secrets.length === 0) {
    return { ok: false, reason: "No webhook signing secret is stored for either mode, so no event can be trusted." };
  }
  let lastReason = "Signature did not match any configured endpoint secret.";
  for (const { mode, secret } of secrets) {
    const r = verifyStripeSignature(rawBody, header, secret, nowSeconds);
    if (r.ok) return { ok: true, mode };
    lastReason = r.reason;
  }
  return { ok: false, reason: lastReason };
}

/** The narrow slice of a Checkout Session this integration acts on. */
export interface CheckoutCompleted {
  eventId: string;
  eventType: string;
  sessionId: string;
  paymentIntentId: string | null;
  /** Stripe's word, not ours: only "paid" is a payment. */
  paymentStatus: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  /** `metadata.revioInvoiceId`, set when the session was created. */
  invoiceId: string | null;
  livemode: boolean | null;
}

/**
 * Both events are payment truth for Checkout.
 *
 * `checkout.session.completed` is enough for cards and wallets. Delayed methods complete the
 * browser flow while still pending and later report the actual payment through
 * `checkout.session.async_payment_succeeded`. Treating only the first event as actionable leaves a
 * successfully paid invoice open forever when a delayed method is enabled in Stripe.
 */
const SUCCESSFUL_CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
const str = (o: Record<string, unknown>, k: string): string | null =>
  typeof o[k] === "string" && (o[k] as string).length > 0 ? (o[k] as string) : null;

/**
 * Pull out what we act on, or null if this is not an event we handle.
 *
 * Returning null is a normal outcome, not an error. Stripe delivers whatever the endpoint is
 * subscribed to, and an endpoint that 500s on an event it does not care about gets retried forever
 * and eventually disabled by Stripe — taking the events we DO care about down with it.
 */
export function readCheckoutCompleted(body: unknown): CheckoutCompleted | null {
  const root = obj(body);
  if (!root) return null;
  const eventType = str(root, "type");
  const eventId = str(root, "id");
  if (!eventType || !eventId || !SUCCESSFUL_CHECKOUT_EVENTS.has(eventType)) return null;

  const data = obj(root.data);
  const session = data ? obj(data.object) : null;
  if (!session) return null;

  const sessionId = str(session, "id");
  if (!sessionId) return null;

  const metadata = obj(session.metadata);
  const pi = session.payment_intent;

  return {
    eventId,
    eventType,
    sessionId,
    // Expanded or not, Stripe sends this either as an id or as the object itself.
    paymentIntentId: typeof pi === "string" ? pi : obj(pi) ? str(obj(pi)!, "id") : null,
    paymentStatus: str(session, "payment_status"),
    amountTotalMinor: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: str(session, "currency")?.toUpperCase() ?? null,
    invoiceId: metadata ? str(metadata, "revioInvoiceId") : null,
    livemode: typeof root.livemode === "boolean" ? root.livemode : null,
  };
}

/**
 * Metadata says which invoice a session claims to pay; the stored id proves we created that exact
 * session for it. A missing stored id is therefore a refusal, not a wildcard.
 */
export function matchesStoredCheckoutSession(storedSessionId: string | null, eventSessionId: string): boolean {
  return storedSessionId !== null && storedSessionId === eventSessionId;
}
