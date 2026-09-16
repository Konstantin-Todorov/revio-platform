/**
 * Put live stays back on the demo hotels' calendars, by hand.
 *
 * The work is in `src/demo-stays.ts` so the nightly `demo-refresh` job and this command share ONE
 * definition — this file is only the argument and the printing.
 *
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts           # dry run
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts --apply
 */
import { refreshDemoStays } from "../src/demo-stays.js";

refreshDemoStays({ apply: process.argv.includes("--apply") })
  .then(({ lines }) => {
    for (const l of lines) console.log(l);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
