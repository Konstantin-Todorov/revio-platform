#!/usr/bin/env node
/**
 * `pnpm lint` — ESLint, plus the guard that makes the original bug impossible.
 *
 * ## The bug
 *
 * `pnpm lint` used to be `pnpm -r lint`, and not one of the thirteen workspace packages defined a
 * `lint` script. pnpm printed "None of the selected packages has a lint script" and **exited 0**. The
 * repo had a lint command that had never once looked at a line of code, and it passed every time.
 *
 * This is the same failure as `scripts/copy-lint.mjs`, which once reported "clean" after scanning
 * zero files because a path with a space in it broke every `readdir`. Both are the same shape: a
 * check that cannot go red is worse than no check, because people trust it.
 *
 * So this wrapper asserts three things, and any of them failing is a non-zero exit:
 *
 *   1. **Files were actually linted.** Zero files is a broken config, never a clean repo.
 *   2. **No errors.**
 *   3. **Warnings stay under budget.** Warnings that nobody has to fix become warnings nobody reads.
 *      Lower the budget when you fix some; raising it should feel like a decision.
 */
import { ESLint } from "eslint";

/** Ratchet. Lower it when the count drops; raising it is a choice someone has to make on purpose. */
const MAX_WARNINGS = 25;

const eslint = new ESLint({ cwd: process.cwd() });

let results;
try {
  results = await eslint.lintFiles(["."]);
} catch (err) {
  // ESLint throws rather than returning an empty list when everything is ignored — an over-broad
  // `ignores` entry lands here, not in the length check below. Catching it is the difference between
  // a stack trace and a sentence that says what is wrong.
  console.error(
    "lint: ESLint could not lint anything.\n" +
      "This is almost always an over-broad `ignores` entry in eslint.config.mjs — a repo that lints\n" +
      "nothing is broken, not clean.\n\n" +
      String(err?.message ?? err),
  );
  process.exit(2);
}

const errors = results.reduce((n, r) => n + r.errorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);

if (results.length === 0) {
  console.error(
    "lint: 0 files were linted — the config is broken, not the code.\n" +
      "Check `ignores` in eslint.config.mjs before believing this repo is clean.",
  );
  process.exit(2);
}

if (errors > 0 || warnings > 0) {
  const formatter = await eslint.loadFormatter("stylish");
  console.log(await formatter.format(results));
}

console.log(`lint: ${results.length} files · ${errors} errors · ${warnings} warnings (budget ${MAX_WARNINGS})`);

if (errors > 0) process.exit(1);
if (warnings > MAX_WARNINGS) {
  console.error(
    `lint: ${warnings} warnings exceeds the budget of ${MAX_WARNINGS}.\n` +
      "Fix some, or change the budget in scripts/lint.mjs and say why in the commit.",
  );
  process.exit(1);
}
