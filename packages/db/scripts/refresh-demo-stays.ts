/**
 * Put live stays back on the demo hotels' calendars, by hand.
 *
 * The work is in `src/demo-stays.ts` so the nightly `demo-refresh` job and this command share ONE
 * definition — this file is only the argument and the printing.
 *
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts           # dry run
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts --apply
 */
import { closeStaleDemoStays, refreshDemoStays } from "../src/demo-stays.js";

const apply = process.argv.includes("--apply");
refreshDemoStays({ apply })
  .then(async ({ lines }) => {
    for (const l of lines) console.log(l);
    // The hand-made stays the refresh does not own — checked out once they are days past departure.
    console.log("\nStale hand-made demo stays:");
    for (const l of (await closeStaleDemoStays({ apply })).lines) console.log(`  ${l}`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
