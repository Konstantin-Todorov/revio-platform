#!/usr/bin/env node
/**
 * Does `schema.prisma` say the same thing the migrations actually do?
 *
 * ## Why this is in `pnpm verify` and not only in CI
 *
 * It was only in CI, and on 2026-09-11 that cost a red build on `main`: an index was added in a
 * migration's SQL and not declared on the model. Every local gate was green — typecheck, eleven
 * lints, 2,005 tests, a full build — because none of them compares the two. The first thing that
 * noticed was a push, which is the slowest and most public place to find out.
 *
 * ⚠️ **Drift is not cosmetic.** `prisma migrate diff` is what a future `migrate dev` reads to decide
 * what to generate, so an undeclared index is a migration somebody else's branch will silently try
 * to *drop*. The two descriptions of one database have to agree.
 *
 * ## It needs a database, and says so rather than passing
 *
 * `migrate diff` replays every migration into a scratch "shadow" database, so there is nothing to
 * compare without one. When none is reachable this **skips loudly** instead of reporting success —
 * a check that quietly passes when it could not run is the failure mode this codebase keeps finding
 * (`trial-sweep` returned 200 for its whole life without ever running).
 */
import { execFileSync } from "node:child_process";

const url =
  process.env.SHADOW_DATABASE_URL ||
  (process.env.DATABASE_URL ? `${process.env.DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/revio_drift_shadow$1")}` : null);

if (!url) {
  console.warn(
    "drift-lint: SKIPPED — no SHADOW_DATABASE_URL and no DATABASE_URL to derive one from.\n" +
      "            Schema-vs-migration drift is NOT checked. CI runs it against its own Postgres;\n" +
      "            to run it here, create a scratch database and set SHADOW_DATABASE_URL to it.",
  );
  process.exit(0);
}

try {
  execFileSync(
    "npx",
    [
      "prisma", "migrate", "diff",
      "--from-migrations", "./prisma/migrations",
      "--to-schema-datamodel", "./prisma/schema.prisma",
      "--shadow-database-url", url,
      "--exit-code",
    ],
    { cwd: "packages/db", stdio: "pipe", encoding: "utf8" },
  );
  console.log("drift-lint: clean — the schema and the migrations describe the same database.");
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  // Exit 2 is Prisma's "there IS a difference"; anything else is the tool failing to run at all,
  // and the two must not be reported as the same thing.
  if (err.status === 2) {
    console.error(
      "drift-lint: SCHEMA DRIFT — `schema.prisma` and the migrations disagree.\n\n" +
        out.split("\n").filter((l) => l.trim()).slice(-8).join("\n") +
        "\n\nA change made in a migration must also be declared on the model. Otherwise the next\n" +
        "`migrate dev` reads the schema as the truth and generates a migration that undoes it.",
    );
    process.exit(1);
  }
  console.warn(`drift-lint: SKIPPED — could not reach the shadow database.\n${out.trim().split("\n").slice(-3).join("\n")}`);
  process.exit(0);
}
