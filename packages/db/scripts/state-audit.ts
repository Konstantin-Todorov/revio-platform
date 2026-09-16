/**
 * Run the state-integrity checks and print them.
 *
 * The checks themselves live in `src/state-integrity.ts` so the operator console and this command
 * read ONE definition. This file is only the printing.
 *
 *   DATABASE_URL=… pnpm --filter @revio/db state-audit
 *
 * Read-only. Safe against production, and meant to be run there.
 */
import { withSystemTransaction } from "../src/rls.js";
import { runStateAudit, faultSummary } from "../src/state-integrity.js";

async function main() {
  // ⚠️ withSystemTransaction, never forSystem(): a raw read on that proxy gets no bypass GUC and
  // returns zero rows, which would report a perfectly clean database no matter what is in it.
  const faults = await withSystemTransaction(async (tx) => runStateAudit(tx));
  const { healthy, failing, totalRows } = faultSummary(faults);

  const width = Math.max(...faults.map((f) => f.fault.length));
  console.log("\n=== State-integrity audit ===\n");
  for (const f of [...faults].sort((a, b) => b.rows - a.rows || a.fault.localeCompare(b.fault))) {
    console.log(`  ${f.fault.padEnd(width)}  ${String(f.rows).padStart(4)}  ${f.rows === 0 ? "ok" : f.remedy}`);
  }
  console.log(
    healthy
      ? "\nZero rows everywhere — every record has an action available to it.\n"
      : `\n${failing.length} fault(s), ${totalRows} row(s). Each is a record a hotelier can reach.\n`,
  );
  // Non-zero exit so this can gate something later without rewriting it.
  process.exitCode = healthy ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});
