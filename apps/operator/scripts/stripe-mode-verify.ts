/**
 * Proves how the console decides whether it is charging real cards.
 *
 *   pnpm --filter @revio/operator stripe-mode-verify
 *
 * ## Why this walks a sequence rather than asserting a value
 *
 * The defect it guards against is not a wrong answer — it is a **transition nobody asked for**. The
 * mode used to be derived from what was configured, so the ordinary act of pasting a live key to
 * check the connection worked silently made the next payment link charge a real card. You cannot
 * see that in a single reading; you see it by doing the innocent thing and watching the answer move.
 *
 * So this walks the real sequence against a real database:
 *
 *   1. nothing configured                        → sandbox
 *   2. a live key stored and checked ok          → STILL sandbox   ← the whole point
 *   3. somebody chooses live                     → live
 *   4. the live key disappears                   → still live, and the screen says it cannot work
 *   5. back to sandbox                           → sandbox
 *
 * ⚠️ Point it at a scratch database. It writes the operator company row and platform credentials,
 * and restores what it found on the way out.
 */
import { forSystem, encryptSecret } from "@revio/db";
import { activeStripeMode, stripeModeStatus } from "../lib/integrations";

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
    console.error(`stripe-mode-verify writes, so it only runs against a local database. DATABASE_URL="${target.replace(/:\/\/[^@]*@/, "://***@")}"`);
    process.exit(2);
  }
}

const sys = forSystem();

async function setChoice(mode: "test" | "live") {
  await sys.operatorCompany.update({ where: { id: "singleton" }, data: { stripeMode: mode } });
}

/**
 * What a Stripe account that has finished verification looks like.
 *
 * ⚠️ `lastCheckOk: true` only means the KEY authenticated. Live mode additionally requires Stripe to
 * have confirmed the account can accept charges — a key can be valid on an account that is still
 * mid-verification and cannot take a payment. The fixture predates that rule, so it produced an
 * account that authenticates and cannot charge, and the product correctly said so.
 */
const CHARGES_ENABLED = { chargesEnabled: true } as const;

/**
 * Store a live credential the way a CONFIGURED integration actually looks.
 *
 * ⚠️ It must carry the webhook signing secret as well as the API key, and this script stored only
 * the key — so step 3 asserted "with a working key it reports no problem" while the product
 * correctly answered:
 *
 *   "Payments are set to LIVE, but no webhook signing secret is stored. A card could be charged
 *    while the invoice remains unpaid in Revio."
 *
 * That is exactly the failure the check exists to prevent, and it was being reported as a FAIL of
 * the code rather than a gap in the fixture. An API key alone is not a working payments setup: it
 * can take money and cannot hear that it did.
 */
async function putLiveKey(lastCheckOk: boolean | null) {
  await sys.platformCredential.upsert({
    where: { provider_mode: { provider: "stripe", mode: "live" } },
    update: {
      lastCheckOk,
      lastCheckedAt: lastCheckOk === null ? null : new Date(),
      webhookCipher: encryptSecret("whsec_scratch_never_real"),
      lastCheckDetail: lastCheckOk ? CHARGES_ENABLED : undefined,
    },
    create: {
      provider: "stripe", mode: "live",
      cipher: encryptSecret("sk_live_scratch_never_real"), hint: "sk_live_••••eal",
      webhookCipher: encryptSecret("whsec_scratch_never_real"),
      lastCheckOk, lastCheckedAt: lastCheckOk === null ? null : new Date(),
      lastCheckDetail: lastCheckOk ? CHARGES_ENABLED : undefined,
    },
  });
}

async function main() {
  const company = await sys.operatorCompany.findUnique({ where: { id: "singleton" } });
  if (!company) {
    console.error("REFUSING TO RUN: no operator company row. Seed the database first: pnpm db:seed");
    process.exit(2);
  }
  const restoreMode = company.stripeMode;
  const hadLive = await sys.platformCredential.findUnique({
    where: { provider_mode: { provider: "stripe", mode: "live" } },
  });
  if (hadLive) {
    console.error("REFUSING TO RUN: a live Stripe credential is already stored here. This script writes\n" +
      "and deletes that row, and it will not touch a real one. Point it at a scratch database.");
    process.exit(2);
  }

  let failed = false;
  const check = (ok: boolean, line: string) => {
    console.log(`${ok ? "  ok  " : " FAIL "} ${line}`);
    if (!ok) failed = true;
  };

  try {
    console.log("\nHow the console decides which Stripe environment to use\n");

    // 1 — nothing configured.
    await setChoice("test");
    check((await activeStripeMode()) === "test", "with nothing configured, payments are in sandbox");

    // 2 — THE one. A live key that has been stored and checked, and nobody has chosen live.
    await putLiveKey(true);
    const afterKey = await activeStripeMode();
    check(afterKey === "test",
      `a stored, working LIVE key does not by itself go live — still "${afterKey}"`);
    console.log("         (this is the step the old rule got wrong: it read the key as the decision)");

    // 3 — the deliberate choice.
    await setChoice("live");
    check((await activeStripeMode()) === "live", "choosing live makes it live");
    const liveOk = await stripeModeStatus();
    // A failing assertion has to say what it GOT, or the next person re-derives it from scratch —
    // which is the afternoon this one cost.
    check(
      liveOk.usable && liveOk.problem === null,
      `and with a working key it reports no problem — usable=${liveOk.usable} problem=${JSON.stringify(liveOk.problem)}`,
    );

    // 4 — the choice outliving the credential.
    await sys.platformCredential.deleteMany({ where: { provider: "stripe", mode: "live" } });
    const orphaned = await stripeModeStatus();
    check(orphaned.mode === "live" && !orphaned.usable,
      `losing the key does NOT quietly drop back to sandbox — still live, and unusable`);
    check(!!orphaned.problem && /no live key is stored/i.test(orphaned.problem),
      `and it says why: "${orphaned.problem}"`);
    console.log("         (dropping silently to sandbox would be worse: links that charge nobody,");
    console.log("          on a console that still reads LIVE)");

    // 5 — back down, which has no precondition on purpose.
    await setChoice("test");
    check((await activeStripeMode()) === "test", "switching back to sandbox always works");

    // And an untested key warns without blocking.
    await putLiveKey(null);
    await setChoice("test");
    const untested = await stripeModeStatus();
    check(untested.usable === false || untested.problem !== null,
      "an untested key is flagged rather than trusted");

    if (failed) console.error("\nThe environment moved without anybody choosing it, or a broken choice was hidden.");
    process.exitCode = failed ? 1 : 0;
  } finally {
    await sys.platformCredential.deleteMany({ where: { provider: "stripe", mode: "live" } });
    await sys.operatorCompany.update({ where: { id: "singleton" }, data: { stripeMode: restoreMode } });
    console.log(`\nCleaned up. Mode restored to "${restoreMode}".\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sys.$disconnect?.());
