/**
 * A query behind a perimeter must run through a client that can cross it.
 *
 * ## The bug this exists for
 *
 * On 2026-09-11 two new modules in `@revio/db` queried `ProductTrial`, `ClientBilling`, `Invoice`,
 * `OperatorCompany` and `Tenant` through the **raw** Prisma client from `./client.js`, which sets
 * no GUC. Every service connects as the restricted `revio_app` role with no `BYPASSRLS`, so those
 * queries did not error — **they returned zero rows**. The trial banner never appeared for anybody
 * and the billing page was blank in all three products.
 *
 * Nothing caught it. The typecheck passed, the build passed, 2,113 tests passed because not one of
 * them touches a database, and the pages rendered successfully — as nothing. It was found by a
 * person opening the screen.
 *
 * ⚠️ **Row-level security fails CLOSED and SILENT.** That is exactly what makes it a good security
 * boundary and a terrible thing to get wrong by accident: there is no error to see, no log line, and
 * the symptom is an empty screen, which looks like "no data yet".
 *
 * ## The rule
 *
 * Inside `packages/db/src`, a model with a non-default RLS policy may only be reached through
 * `forSystem()`, `forTenant()`, `withSystemTransaction` or `withTenantTransaction`. A file that
 * imports `prisma` from `./client.js` and then touches one of those models is the bug above.
 *
 * Run: `node scripts/perimeter-lint.mjs` (part of `pnpm verify` and CI).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — this repo lives under a directory with a space in its name, and
// .pathname percent-encodes it. That bug once made copy-lint report "clean" having scanned nothing.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "packages/db/src");
/*
 * App code is scanned too, because `@revio/db` exports the raw `prisma` client — so an app can
 * import it and reproduce this bug outside the package where it was written. Only two files do
 * today and both are DB-backed tests, which legitimately need the raw client to build fixtures.
 */
const APP_DIRS = ["apps", "packages/connectivity/src", "packages/booking/src"];
const MIGRATIONS = join(ROOT, "packages/db/prisma/migrations");

/**
 * Every model carrying a policy, read from the migrations themselves rather than from a list kept
 * here. A hand-maintained list is wrong the first time somebody adds a table and does not update it
 * — and the failure mode of THIS check being out of date is that it goes quiet, which is the same
 * failure it exists to prevent.
 */
function guardedModels() {
  const models = new Set();
  for (const dir of readdirSync(MIGRATIONS)) {
    const file = join(MIGRATIONS, dir, "migration.sql");
    let sql;
    try {
      sql = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of sql.matchAll(/CREATE POLICY\s+\w+\s+ON\s+"([A-Za-z0-9_]+)"/g)) {
      models.add(m[1]);
    }
    // `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY` with the policy created in a DO/format() loop.
    for (const m of sql.matchAll(/ALTER TABLE\s+"([A-Za-z0-9_]+)"\s+ENABLE ROW LEVEL SECURITY/g)) {
      models.add(m[1]);
    }

    /*
     * ⚠️ Most of this schema's policies are applied in bulk, by a PL/pgSQL loop:
     *
     *   FOREACH t IN ARRAY ARRAY['Folio','FolioLine'] LOOP … EXECUTE format($p$CREATE POLICY …
     *
     * The table names live in an array literal, so neither pattern above sees them. Missing this
     * left `Invoice`, `Folio`, `Guest`, `Unit` and most of the rest OUT of the guarded set — the
     * check would have reported "clean" over exactly the tables it exists to protect, which is the
     * same silent-pass failure it was written to stop.
     *
     * Only in migrations that mention row-level security at all, and deliberately over-collecting
     * within those: a name gathered here that turns out not to be protected costs one visible lint
     * failure somebody resolves, while a name missed costs a blank screen nobody notices.
     */
    if (/ROW LEVEL SECURITY/i.test(sql)) {
      for (const arr of sql.matchAll(/ARRAY\s*\[([^\]]+)\]/g)) {
        for (const name of arr[1].matchAll(/'([A-Za-z][A-Za-z0-9_]*)'/g)) {
          models.add(name[1]);
        }
      }
    }
  }
  return models;
}

/** Prisma's client property for a model: `ProductTrial` → `productTrial`. */
const accessorOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

function tsFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    // ⚠️ `.test.ts` is excluded on purpose: a DB-backed test sets up its own fixtures and needs the
    // raw client to write rows no perimeter would let it write. That is the one honest exception.
    else if ((entry.endsWith(".ts") || entry.endsWith(".tsx")) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const models = guardedModels();
const byAccessor = new Map([...models].map((m) => [accessorOf(m), m]));
const problems = [];

const scanned = [...tsFiles(SRC), ...APP_DIRS.flatMap((d) => tsFiles(join(ROOT, d)))];

for (const file of scanned) {
  const rel = file.slice(ROOT.length + 1);
  const raw = readFileSync(file, "utf8");
  /*
   * Comments are stripped before scanning, and that is not tidiness.
   *
   * `inventory-claim.ts` documents the exact WRONG shape it exists to prevent — `await
   * prisma.hold.create(...)` inside a prose block explaining the double-booking race. Scanning the
   * raw text reported it as a live query, which is a lint crying wolf about its own documentation:
   * the fastest way to have somebody add an ignore comment and stop reading the output.
   *
   * Newlines are preserved so the reported line numbers still point at the real line.
   */
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

  // `client.ts` IS the raw client and `rls.ts` is what wraps it; neither is a caller.
  if (rel.endsWith("src/client.ts") || rel.endsWith("src/rls.ts")) continue;

  // Does this file bind `prisma` to the RAW client — from inside the package, or via its export?
  const rawImport =
    /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']\.\/client\.js["']/.test(src) ||
    /import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*["']@revio\/db["']/.test(src);
  if (!rawImport) continue;

  for (const [accessor, model] of byAccessor) {
    // `prisma.productTrial.` — the property access, not a mention in a comment.
    const re = new RegExp(`\\bprisma\\.${accessor}\\s*\\.`, "g");
    const hits = [...src.matchAll(re)];
    for (const hit of hits) {
      const line = src.slice(0, hit.index).split("\n").length;
      problems.push({ rel, line, model });
    }
  }
}

if (problems.length > 0) {
  console.error(`\nperimeter-lint: ${problems.length} quer${problems.length === 1 ? "y" : "ies"} on a protected table through the RAW client:\n`);
  for (const p of problems) {
    console.error(`  ${p.rel}:${p.line}  →  ${p.model}`);
  }
  console.error(
    "\nRow-level security fails CLOSED and SILENT: these return ZERO ROWS rather than erroring,\n" +
      "and the screen above them renders nothing at all. That is what shipped on 2026-09-11.\n\n" +
      "Use `forSystem()` (operator perimeter) or `forTenant(id)` (one hotel) instead of the raw\n" +
      "client — `const prisma = forSystem();` at the top of the module is the usual shape.\n",
  );
  process.exit(1);
}

console.log(
  `perimeter-lint: clean — ${scanned.length} files, ${models.size} protected table(s), ` +
    `none reached through the raw client.`,
);
