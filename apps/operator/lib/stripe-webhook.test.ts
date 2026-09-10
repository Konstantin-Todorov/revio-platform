import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyStripeSignature, verifyAgainstModes, parseSignatureHeader, readCheckoutCompleted,
  matchesStoredCheckoutSession, SIGNATURE_TOLERANCE_SECONDS,
} from "./stripe-webhook";

/**
 * The endpoint this guards marks invoices PAID from a public URL.
 *
 * So these are not shape tests. Each one below is an attack or a misconfiguration that would
 * otherwise let somebody clear their own bill, and the assertion is that it is refused.
 */

const SECRET = "whsec_test_not_a_real_secret";
const OTHER_SECRET = "whsec_test_a_different_one";
const NOW = 1_780_000_000;

const sign = (body: string, secret: string, t = NOW) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex")}`;

const BODY = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  livemode: false,
  data: { object: { id: "cs_1", payment_status: "paid", amount_total: 14160, currency: "eur", payment_intent: "pi_1", metadata: { revioInvoiceId: "inv_1" } } },
});

describe("verifyStripeSignature — what must be accepted", () => {
  it("accepts a genuine signature", () => {
    expect(verifyStripeSignature(BODY, sign(BODY, SECRET), SECRET, NOW)).toEqual({ ok: true });
  });

  it("accepts when any one of several v1 signatures matches", () => {
    // Normal during a secret rotation: Stripe signs with both the old and the new endpoint secret.
    // Rejecting a header that carries an unfamiliar signature alongside a good one would drop every
    // event for the length of the rotation.
    const good = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`, "utf8").digest("hex");
    expect(verifyStripeSignature(BODY, `t=${NOW},v1=${"0".repeat(64)},v1=${good}`, SECRET, NOW).ok).toBe(true);
  });

  it("ignores signature schemes it does not know", () => {
    const good = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`, "utf8").digest("hex");
    expect(verifyStripeSignature(BODY, `t=${NOW},v0=deadbeef,v1=${good}`, SECRET, NOW).ok).toBe(true);
  });
});

describe("verifyStripeSignature — what must be refused", () => {
  it("refuses a body altered by one character", () => {
    /*
     * THE test. This is the forgery that matters: change the invoice id, or the amount, and keep a
     * signature that was valid for the original.
     */
    const header = sign(BODY, SECRET);
    const tampered = BODY.replace('"inv_1"', '"inv_someone_elses"');
    expect(verifyStripeSignature(tampered, header, SECRET, NOW).ok).toBe(false);
  });

  it("refuses a signature made with a different secret", () => {
    expect(verifyStripeSignature(BODY, sign(BODY, OTHER_SECRET), SECRET, NOW).ok).toBe(false);
  });

  it("refuses an event replayed after the tolerance", () => {
    /*
     * A captured event keeps a perfectly valid signature forever — that is exactly what makes replay
     * possible — so age has to be its own gate. Without this, one intercepted "paid" event can be
     * resent every month.
     */
    const old = NOW - SIGNATURE_TOLERANCE_SECONDS - 1;
    const r = verifyStripeSignature(BODY, sign(BODY, SECRET, old), SECRET, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/tolerance/);
  });

  it("accepts one that is only just inside the tolerance", () => {
    const edge = NOW - SIGNATURE_TOLERANCE_SECONDS;
    expect(verifyStripeSignature(BODY, sign(BODY, SECRET, edge), SECRET, NOW).ok).toBe(true);
  });

  it("refuses a timestamp far in the FUTURE as well as far in the past", () => {
    // A clock that far ahead is either broken or chosen, and both are reasons not to trust it.
    const ahead = NOW + SIGNATURE_TOLERANCE_SECONDS + 1;
    expect(verifyStripeSignature(BODY, sign(BODY, SECRET, ahead), SECRET, NOW).ok).toBe(false);
  });

  it("refuses a missing header, an empty secret, and junk", () => {
    expect(verifyStripeSignature(BODY, null, SECRET, NOW).ok).toBe(false);
    expect(verifyStripeSignature(BODY, sign(BODY, SECRET), "", NOW).ok).toBe(false);
    expect(verifyStripeSignature(BODY, "nonsense", SECRET, NOW).ok).toBe(false);
    expect(verifyStripeSignature(BODY, `t=${NOW}`, SECRET, NOW).ok).toBe(false);
    expect(verifyStripeSignature(BODY, `v1=abc`, SECRET, NOW).ok).toBe(false);
  });

  it("refuses a signature that is not hex, without throwing", () => {
    // `timingSafeEqual` throws on buffers of different length, and Buffer.from(…, "hex") on junk
    // silently truncates — so this path has to be closed deliberately rather than by luck.
    expect(verifyStripeSignature(BODY, `t=${NOW},v1=zzzz`, SECRET, NOW).ok).toBe(false);
    expect(verifyStripeSignature(BODY, `t=${NOW},v1=`, SECRET, NOW).ok).toBe(false);
  });

  it("refuses a re-serialised body — the raw bytes are what is signed", () => {
    /*
     * The mistake this catches is a route reading `await req.json()` and re-stringifying. The object
     * is identical; the bytes are not, because key order and spacing changed. The symptom is
     * "Stripe keeps sending bad signatures", which sends somebody to look at Stripe.
     */
    const reserialised = JSON.stringify(JSON.parse(BODY.replace('{"id":"evt_1"', '{ "id" : "evt_1"')));
    expect(verifyStripeSignature(reserialised, sign(BODY, SECRET), SECRET, NOW).ok).toBe(
      reserialised === BODY, // identical only if nothing actually changed
    );
    expect(verifyStripeSignature(`${BODY} `, sign(BODY, SECRET), SECRET, NOW).ok).toBe(false);
  });
});

describe("parseSignatureHeader", () => {
  it("reads the timestamp and every v1", () => {
    expect(parseSignatureHeader("t=123,v1=aa,v1=bb")).toEqual({ timestamp: 123, signatures: ["aa", "bb"] });
  });
  it("survives spacing and unknown keys", () => {
    expect(parseSignatureHeader(" t=1 , v1=aa , foo=bar ")).toEqual({ timestamp: 1, signatures: ["aa"] });
  });
  it("reports a non-numeric timestamp as absent rather than NaN", () => {
    expect(parseSignatureHeader("t=later,v1=aa").timestamp).toBeNull();
  });
});

describe("verifyAgainstModes", () => {
  it("reports WHICH mode signed, decided by the verification and not by the body", () => {
    /*
     * The body claims `livemode: false`, and the body is not trustworthy until something verifies
     * it. So the mode comes from whichever secret actually matched — the only ordering that cannot
     * be lied to.
     */
    const r = verifyAgainstModes(BODY, sign(BODY, OTHER_SECRET), [
      { mode: "test", secret: SECRET },
      { mode: "live", secret: OTHER_SECRET },
    ], NOW);
    expect(r).toEqual({ ok: true, mode: "live" });
  });

  it("refuses when no secret matches", () => {
    expect(verifyAgainstModes(BODY, sign(BODY, "whsec_third"), [{ mode: "test", secret: SECRET }], NOW).ok).toBe(false);
  });

  it("refuses outright when NO secret is configured", () => {
    // Fail closed. An endpoint with no secret cannot tell Stripe from anybody else, and the safe
    // reading of "we have not set this up" is to trust nothing.
    const r = verifyAgainstModes(BODY, sign(BODY, SECRET), [], NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/No webhook signing secret/);
  });
});

describe("readCheckoutCompleted", () => {
  it("extracts what the endpoint acts on", () => {
    expect(readCheckoutCompleted(JSON.parse(BODY))).toEqual({
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      paymentStatus: "paid",
      amountTotalMinor: 14160,
      currency: "EUR",
      invoiceId: "inv_1",
      livemode: false,
    });
  });

  it("reads an expanded payment_intent object as well as an id", () => {
    const body = JSON.parse(BODY);
    body.data.object.payment_intent = { id: "pi_expanded" };
    expect(readCheckoutCompleted(body)?.paymentIntentId).toBe("pi_expanded");
  });

  it("accepts Stripe's later success event for delayed payment methods", () => {
    const body = JSON.parse(BODY);
    body.id = "evt_async_1";
    body.type = "checkout.session.async_payment_succeeded";
    expect(readCheckoutCompleted(body)).toMatchObject({
      eventId: "evt_async_1",
      eventType: "checkout.session.async_payment_succeeded",
      sessionId: "cs_1",
      paymentStatus: "paid",
    });
  });

  it("does not treat a delayed payment failure as payment truth", () => {
    const body = JSON.parse(BODY);
    body.type = "checkout.session.async_payment_failed";
    expect(readCheckoutCompleted(body)).toBeNull();
  });

  it("returns null for an event we do not handle, rather than throwing", () => {
    /*
     * Stripe delivers everything the endpoint is subscribed to. A route that 500s on an unrelated
     * event gets retried forever and is eventually disabled by Stripe — which takes the events we DO
     * care about down with it.
     */
    expect(readCheckoutCompleted({ id: "evt_2", type: "customer.created", data: { object: {} } })).toBeNull();
    expect(readCheckoutCompleted(null)).toBeNull();
    expect(readCheckoutCompleted("nope")).toBeNull();
    expect(readCheckoutCompleted({ type: "checkout.session.completed" })).toBeNull();
  });

  it("survives a session with no metadata rather than assuming ours", () => {
    const body = JSON.parse(BODY);
    delete body.data.object.metadata;
    expect(readCheckoutCompleted(body)?.invoiceId).toBeNull();
  });
});

describe("matchesStoredCheckoutSession", () => {
  it("accepts only the exact session id Revio stored for the invoice", () => {
    expect(matchesStoredCheckoutSession("cs_1", "cs_1")).toBe(true);
    expect(matchesStoredCheckoutSession("cs_other", "cs_1")).toBe(false);
  });

  it("refuses an invoice with no stored session instead of treating null as a wildcard", () => {
    expect(matchesStoredCheckoutSession(null, "cs_1")).toBe(false);
  });
});
