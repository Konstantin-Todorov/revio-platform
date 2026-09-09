/**
 * Fires real HTTP at the real Stripe webhook route and checks what it did to the database.
 *
 *   OPERATOR_URL=http://localhost:3010 pnpm --filter @revio/operator webhook-verify
 *
 * ## Why this exists beside the unit tests
 *
 * `stripe-webhook.test.ts` proves the signature check refuses a forgery. That is necessary and not
 * sufficient: a route that never calls it, calls it after parsing, or reads `req.json()` and
 * destroys the raw bytes would pass every one of those tests and still accept anything. The
 * interesting failure lives in the wiring, so the wiring is what this exercises — over HTTP, against
 * a real row, exactly as Stripe would.
 *
 * Four things, and the first is the one that matters:
 *
 *   1. a FORGED signature is refused and the invoice is untouched;
 *   2. a genuine one marks it paid;
 *   3. a REPLAY of the same event changes nothing the second time;
 *   4. an event whose amount does not match the invoice is refused.
 *
 * ⚠️ Point it at a scratch or demo database. It writes an invoice and marks it paid, and it cleans
 * up after itself — including on failure.
 */
import { createHmac } from "node:crypto";
import { forSystem, encryptSecret } from "@revio/db";

const BASE = process.env.OPERATOR_URL ?? "http://localhost:3010";
const ENDPOINT = `${BASE}/api/webhooks/stripe`;
const SECRET = "whsec_verify_scratch_secret_not_real";

const sys = forSystem();

function sign(body: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex")}`;
}

function eventBody(opts: { invoiceId: string; sessionId: string; amountMinor: number; eventId?: string }): string {
  return JSON.stringify({
    id: opts.eventId ?? `evt_verify_${Date.now()}`,
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: opts.sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: opts.amountMinor,
        currency: "eur",
        payment_intent: "pi_verify_1",
        metadata: { revioInvoiceId: opts.invoiceId },
      },
    },
  });
}

async function post(body: string, header: string): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body,
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch { /* a non-JSON answer is itself a result */ }
  return { status: res.status, json };
}

async function main() {
  const reachable = await fetch(ENDPOINT).then((r) => r.ok).catch(() => false);
  if (!reachable) {
    console.error(`REFUSING TO RUN: nothing answering at ${ENDPOINT}.\n` +
      `Start the console first:  pnpm --filter @revio/operator dev -- -p 3010`);
    process.exit(2);
  }

  const tenant = await sys.tenant.findFirst({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  if (!tenant) {
    console.error("REFUSING TO RUN: no tenants in this database. Seed it first: pnpm db:seed");
    process.exit(2);
  }

  // A credential carrying the signing secret, because the route reads it from the database rather
  // than from an environment variable — which is the whole point of the Integrations screen.
  const credential = await sys.platformCredential.upsert({
    where: { provider_mode: { provider: "stripe", mode: "test" } },
    update: { webhookCipher: encryptSecret(SECRET) },
    create: {
      provider: "stripe", mode: "test",
      cipher: encryptSecret("sk_test_scratch"), hint: "sk_test_••••atch",
      webhookCipher: encryptSecret(SECRET),
    },
  });
  const hadCredentialBefore = credential.createdAt.getTime() < Date.now() - 5_000;

  const AMOUNT = 14160;
  const sessionId = `cs_verify_${Date.now()}`;
  const invoice = await sys.invoice.create({
    data: {
      tenantId: tenant.id, period: "2099-01", amountMinor: 11800, currency: "EUR", status: "sent",
      number: `9${Date.now()}`.slice(0, 10), issuedAt: new Date(),
      netMinor: 11800, taxMinor: 2360, grossMinor: AMOUNT,
      stripeSessionId: sessionId,
    },
  });

  const state = async () => sys.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: { status: true, paidVia: true, paidReference: true, paidAt: true },
  });

  let failed = false;
  const check = (ok: boolean, line: string) => {
    console.log(`${ok ? "  ok  " : " FAIL "} ${line}`);
    if (!ok) failed = true;
  };

  try {
    console.log(`\nEndpoint: ${ENDPOINT}`);
    console.log(`Invoice:  ${invoice.number} · €${(AMOUNT / 100).toFixed(2)} · ${tenant.name}\n`);

    // 1 — the forgery. THE test: everything else assumes this one holds.
    const body = eventBody({ invoiceId: invoice.id, sessionId, amountMinor: AMOUNT });
    const forged = await post(body, sign(body, "whsec_attacker_guessed_this"));
    check(forged.status === 400, `a forged signature is refused — HTTP ${forged.status}`);
    check((await state()).status === "sent", "and the invoice was not touched by it");

    // 1b — no signature at all.
    const bare = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body });
    check(bare.status === 400, `an unsigned request is refused — HTTP ${bare.status}`);

    // 1c — a replayed timestamp outside the tolerance, signed correctly.
    const stale = await post(body, sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600));
    check(stale.status === 400, `a correctly-signed but hour-old event is refused — HTTP ${stale.status}`);
    check((await state()).status === "sent", "and that did not touch the invoice either");

    // 2 — the genuine event.
    const good = await post(body, sign(body, SECRET));
    check(good.status === 200 && good.json.handled === true && good.json.changed === true,
      `a genuine event is accepted — HTTP ${good.status} ${JSON.stringify(good.json)}`);
    const after = await state();
    check(after.status === "paid", `the invoice is now paid — status "${after.status}"`);
    check(after.paidVia === "stripe", `and records how — paidVia "${after.paidVia}"`);
    check(after.paidReference === "pi_verify_1", `and the Stripe reference — "${after.paidReference}"`);

    // 3 — the replay. Stripe delivers at least once and retries; the second must change nothing.
    const replay = await post(body, sign(body, SECRET));
    check(replay.status === 200 && replay.json.changed === false,
      `a repeat delivery changes nothing — ${JSON.stringify(replay.json)}`);
    const afterReplay = await state();
    check(afterReplay.paidAt?.getTime() === after.paidAt?.getTime(), "and the payment date did not move");

    // 4 — an event for the right invoice with the wrong money.
    await sys.invoice.update({ where: { id: invoice.id }, data: { status: "sent", paidAt: null, paidVia: null, paidReference: null } });
    const wrong = eventBody({ invoiceId: invoice.id, sessionId, amountMinor: 100 });
    const wrongRes = await post(wrong, sign(wrong, SECRET));
    check(wrongRes.status === 200 && wrongRes.json.handled === false,
      `an event for €1.00 against a €${(AMOUNT / 100).toFixed(2)} invoice is refused — ${JSON.stringify(wrongRes.json)}`);
    check((await state()).status === "sent", "and the invoice stayed unpaid");

    if (failed) console.error("\nThe webhook accepted something it should not have, or refused something it should not have.");
    process.exitCode = failed ? 1 : 0;
  } finally {
    await sys.invoice.delete({ where: { id: invoice.id } }).catch(() => {});
    if (!hadCredentialBefore) {
      await sys.platformCredential.deleteMany({ where: { provider: "stripe", mode: "test" } });
    } else {
      // Somebody's real scratch credential was here first — put its webhook secret back to nothing
      // rather than leaving ours in place pretending to be theirs.
      await sys.platformCredential.updateMany({ where: { provider: "stripe", mode: "test" }, data: { webhookCipher: null } });
    }
    console.log("\nCleaned up.\n");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sys.$disconnect?.());
