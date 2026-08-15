/**
 * Proves only one process can run a job at a time (CX1).
 *
 *   pnpm --filter @revio/db lease-verify
 *
 * Channex asked why we call their feed twice at once. The answer was that the scheduler runs inside
 * the web server, so every server process had its own timer. The fix is a lease — and a lease is
 * exactly the kind of thing that looks correct and isn't, so this races it rather than reasoning
 * about it.
 *
 * It also asserts the two properties that make a lease usable in production: a crashed holder must
 * not block the job forever, and a finished holder must free it immediately rather than making the
 * next tick wait out the TTL.
 */
import { prisma } from "../src/client.js";
import { forSystem } from "../src/rls.js";
import { acquireJobLease, releaseJobLease, withJobLease } from "../src/job-lease.js";

const JOB_NAME = "lease-verify-probe";
const checks: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function reset() {
  await forSystem().jobLease.deleteMany({ where: { name: JOB_NAME } });
}

async function main() {
  console.log(`\nRacing the job lease "${JOB_NAME}"\n`);
  await reset();

  try {
    // ---------------------------------------------------------------------
    // 1. Twelve processes tick at once. Exactly one may run.
    // ---------------------------------------------------------------------
    const RACERS = 12;
    let concurrent = 0;
    let maxConcurrent = 0;

    const results = await Promise.all(
      Array.from({ length: RACERS }, () =>
        withJobLease(JOB_NAME, 60_000, async () => {
          // Count how many bodies are in flight simultaneously. If the lease works this never
          // exceeds 1 — and that, not the return value, is the actual guarantee.
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 40));
          concurrent -= 1;
          return true;
        }),
      ),
    );

    const winners = results.filter((r) => r.ran).length;
    record("exactly one of 12 concurrent ticks ran the job", winners === 1, `${winners} ran, ${RACERS - winners} skipped`);
    record("the job body never ran twice at the same moment", maxConcurrent <= 1, `peak concurrency ${maxConcurrent}`);
    record(
      "every loser was told who holds it",
      results.filter((r) => !r.ran).every((r) => !r.ran && typeof r.heldBy === "string"),
      "so a stuck job can be traced to a machine",
    );

    // ---------------------------------------------------------------------
    // 2. A finished holder frees the lease immediately.
    //    Otherwise the next tick sits out the TTL for no reason.
    // ---------------------------------------------------------------------
    const again = await withJobLease(JOB_NAME, 60_000, async () => "second run");
    record("the next tick can run once the previous one finished", again.ran, again.ran ? "acquired immediately" : "still blocked");

    // ---------------------------------------------------------------------
    // 3. A crashed holder must not block the job forever.
    //    Simulated by taking a lease with a TTL that has already elapsed.
    // ---------------------------------------------------------------------
    await reset();
    await acquireJobLease(JOB_NAME, -1_000); // expired the moment it was taken
    const takeover = await withJobLease(JOB_NAME, 60_000, async () => "took over");
    record("an expired lease can be taken over (a crashed instance self-heals)", takeover.ran, "no flag for a human to clear");

    // ---------------------------------------------------------------------
    // 4. A live lease is genuinely exclusive.
    // ---------------------------------------------------------------------
    await reset();
    const held = await acquireJobLease(JOB_NAME, 60_000);
    const blocked = await acquireJobLease(JOB_NAME, 60_000);
    record("a live lease blocks a second acquirer", held.acquired && !blocked.acquired, `first=${held.acquired}, second=${blocked.acquired}`);
    await releaseJobLease(JOB_NAME);
  } finally {
    await reset();
    console.log("\nCleaned up.");
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
