#!/usr/bin/env node
/**
 * Bans `$transaction(async …)` on an RLS-scoped client.
 *
 * `forSystem()` and `forTenant()` return EXTENDED clients that run every model call through their own
 * `$transaction([setGuc, query])` — on its own connection. Calling `$transaction(async tx => …)` on
 * one of them looks like a transaction and is not: each `tx.model.op()` inside escapes it. Found on
 * 2026-09-26 when deleting a real client crashed the operator console — `tx.tenant.delete()` could
 * not see the reservations deleted one line above it — and in two more places where "all or nothing"
 * had quietly been "some of it".
 *
 * Use `withSystemTransaction` / `withTenantTransaction` from `@revio/db`, which set the RLS setting as
 * the transaction's first statement and hand over a plain transaction client.
 *
 * Rule: a file that imports `forSystem` or `forTenant` may not contain `$transaction(async`.
 * `packages/db/src/rls.ts` (where the safe versions are built) is exempt. A line that must say it
 * anyway carries `txscope:allow`.
 *
 * Run: node scripts/txscope-lint.mjs   (part of `pnpm verify`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".next", "dist", "coverage", ".turbo"]);
const EXEMPT = new Set([join("packages", "db", "src", "rls.ts")]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

const hits = [];
let files = 0;
for (const root of ["apps", "packages"]) {
  for (const file of walk(root)) {
    if (EXEMPT.has(file)) continue;
    const text = readFileSync(file, "utf8");
    if (!/\bfor(System|Tenant)\b/.test(text)) continue;
    files++;
    text.split("\n").forEach((line, i) => {
      if (line.includes("txscope:allow")) return;
      if (/^\s*(\*|\/\/)/.test(line)) return; // prose about the pattern is not the pattern
      if (/\$transaction\(\s*async/.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
}
if (hits.length) {
  console.error(
    `txscope-lint FAILED — $transaction(async …) on an RLS-scoped client does not make one transaction:\n` +
      hits.map((h) => `  ${h}`).join("\n") +
      `\nUse withSystemTransaction / withTenantTransaction from @revio/db.`,
  );
  process.exit(1);
}
console.log(`txscope-lint: ${files} files that use a scoped client, no fake transactions.`);
