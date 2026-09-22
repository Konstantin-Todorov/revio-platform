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

/*
 * Writes, so it runs against a LOCAL database only — the same guard `folio-atomic-verify` carries.
 *
 * ⚠️ Nothing stopped this pointing at production until 2026-09-22. `packages/booking` has no `.env`
 * of its own, so a harness there uses whatever DATABASE_URL the shell happens to export — and the
 * public production URL is one `railway variables` away in every runbook in this repo. `localhost`
 * matches both a developer's `revio_dev` and CI's throwaway `revio_ci`, which is why the guard is on
 * the host rather than on a database name.
 */
{
  const target = process.env.DATABASE_URL ?? "";
  // Anchored to the HOST: `scheme://[user[:pass]@]host[:port]/`. A bare substring test would pass
  // `postgresql://u@db.example.com/localhost_copy`; requiring an `@` would refuse the perfectly
  // local `postgresql://localhost:5432/revio_dev` that this repo's own runbooks use.
  if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(target)) {
    console.error(`webhook-verify writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

/*
 * The console's own dev port is 3001 (`next dev -p 3001`). This defaulted to 3010, which nothing
 * starts, so the script refused on a normally-running stack and told you to start a SECOND console
 * on a port no other tool uses.
 */
const BASE = process.env.OPERATOR_URL ?? "http://localhost:3001";
const ENDPOINT = `${BASE}/api/webhooks/stripe`;

/*
 * ⚠️ The endpoint is guarded as well as the database, because this script sends FORGED Stripe events.
 *
 * `OPERATOR_URL` is not a name this script invented: it is a real Railway variable on the `jobs`
 * service, pointing at the production console. Anyone who has run `railway run` or exported a
 * service's variables has it in their shell. Production would refuse every forgery — refusing them
 * is exactly what this proves — but firing test traffic at the live payment webhook is not
 * something to do by accident, and the database guard above cannot see where HTTP goes.
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE)) {
  console.error(`webhook-verify sends forged Stripe events, so it only targets a local console. OPERATOR_URL="${BASE}"`);
  process.exit(2);
}
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
      `Start the console first:  pnpm --filter @revio/operator dev` +
      `\n(or point this at another one: OPERATOR_URL=http://localhost:PORT …)`);
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

  /*
   * ⚠️ Preflight: can the ROUTE read what we just wrote?
   *
   * The secret is stored encrypted, and `encryptSecret` keys off CONNECTIVITY_SECRET (falling back
   * to AUTH_SECRET). This script and the dev server are separate processes: run it without the
   * console's own secret and it writes a cipher the route cannot open, so every genuine event is
   * correctly refused — and the run printed SIX FAILs that read as "the payment webhook is broken"
   * when nothing was wrong with it at all.
   *
   * A payments verifier reporting a false failure is worse than one that does not run, so this
   * asks first and refuses with the actual remedy.
   */
  const probeBody = JSON.stringify({ id: "evt_preflight", type: "ping", data: { object: {} } });
  const probe = await post(probeBody, sign(probeBody, SECRET));
  if (probe.status === 400 && /no webhook signing secret/i.test(JSON.stringify(probe.json))) {
    console.error(
      "\nREFUSING TO RUN: the console cannot decrypt the signing secret this script just stored.\n" +
      "Both processes must share one key. Re-run with the console's own:\n\n" +
      `  AUTH_SECRET=$(grep '^AUTH_SECRET=' apps/operator/.env.local | cut -d= -f2-) \\\n` +
      "  OPERATOR_URL=http://localhost:3001 pnpm --filter @revio/operator webhook-verify\n",
    );
    process.exit(2);
  }

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

    // 5 — money going back out (S2). Restore the paid state first: step 4 deliberately unpaid it.
    const settle = eventBody({ invoiceId: invoice.id, sessionId, amountMinor: AMOUNT });
    await post(settle, sign(settle, SECRET));
    const paidAgain = await state();
    check(paidAgain.status === "paid", "re-settled, ready to test a refund");

    const refund = (cumulative: number, eventId: string) =>
      JSON.stringify({
        id: eventId, type: "charge.refunded", livemode: false,
        data: { object: { id: "ch_verify", object: "charge", payment_intent: "pi_verify_1",
          amount: AMOUNT, amount_refunded: cumulative, currency: "eur",
          metadata: { revioInvoiceId: invoice.id } } },
      });

    const partial = refund(5000, "evt_refund_1");
    const r1 = await post(partial, sign(partial, SECRET));
    const afterPartial = await sys.invoice.findUniqueOrThrow({
      where: { id: invoice.id }, select: { status: true, refundedMinor: true },
    });
    check(r1.status === 200 && afterPartial.refundedMinor === 5000,
      `a partial refund is recorded — €50.00 of €${(AMOUNT / 100).toFixed(2)}`);
    /*
     * THE rule. A refund does not un-issue an invoice: the supply happened and the payment happened.
     * Flipping it back to unpaid would rewrite history and put the customer on the chase list as
     * though they had never paid at all.
     */
    check(afterPartial.status === "paid", `and the invoice is STILL paid — status "${afterPartial.status}"`);

    // Out of order: an older cumulative figure must not undo a larger refund already recorded.
    const staleRefund = refund(1000, "evt_refund_stale");
    await post(staleRefund, sign(staleRefund, SECRET));
    const afterStale = await sys.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { refundedMinor: true } });
    check(afterStale.refundedMinor === 5000, "an out-of-order refund event never moves the total backwards");

    const full = refund(AMOUNT, "evt_refund_2");
    await post(full, sign(full, SECRET));
    const afterFull = await sys.invoice.findUniqueOrThrow({
      where: { id: invoice.id }, select: { status: true, refundedMinor: true },
    });
    check(afterFull.refundedMinor === AMOUNT && afterFull.status === "paid",
      "a full refund is recorded and the invoice is still paid — the two are separate facts");

    // And a dispute, which is money Stripe is holding rather than money returned.
    const dispute = JSON.stringify({
      id: "evt_dispute_1", type: "charge.dispute.created", livemode: false,
      data: { object: { id: "dp_verify", payment_intent: "pi_verify_1", amount: AMOUNT, currency: "eur", status: "needs_response" } },
    });
    await post(dispute, sign(dispute, SECRET));
    const disputed = await sys.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { disputeStatus: true } });
    check(disputed.disputeStatus === "needs_response", `a dispute records Stripe's own status — "${disputed.disputeStatus}"`);

    // A forged refund must be refused exactly as a forged payment is.
    const forgedRefund = await post(full, sign(full, "whsec_attacker"));
    check(forgedRefund.status === 400, `a forged refund is refused — HTTP ${forgedRefund.status}`);

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
