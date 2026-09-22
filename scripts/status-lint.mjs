/**
 * A claim about what is built must cite the code, and the citation must be true.
 *
 * ## Why this exists
 *
 * In three days, **five** separate claims in these documents turned out to be wrong, every one in
 * the same direction — work recorded as open that had already shipped:
 *
 *   - "Refunds and recurring" — refunds were built; the Stripe webhook records them.
 *   - The cancelled-reservation-with-an-open-folio bug — fixed in `425537b`.
 *   - The CM/CRS search dead end — covered by the property-switch fix.
 *   - "Duplicated surnames" — does not reproduce.
 *   - "Send the payment link … that email is not built yet" — `emailInvoiceToCustomer` sends it, and
 *     that sentence sat 130 lines above the button in the same file.
 *
 * Each cost an investigation, and two nearly cost duplicate work. `STATUS.md` already carries the
 * rule — *"check the code before repeating any list"* — and the rule did not hold, because a rule
 * that depends on somebody remembering is a wish. This repo's own answer to that is a guard, so:
 *
 * ## The convention
 *
 * A claim that something is or is not built cites a symbol, in a comment beside it:
 *
 *     <!-- status: built apps/operator/lib/actions-integrations.ts#emailInvoiceToCustomer -->
 *     <!-- status: not-built apps/pms/lib/calendar-extend.ts#extendStayByDrag -->
 *
 * `built` fails if the symbol is missing — the document is over-claiming. `not-built` fails if the
 * symbol is present — the document is stale, which is the failure that actually keeps happening.
 *
 * ⚠️ **A missing symbol under `not-built` is not proof of anything**, and this lint does not pretend
 * otherwise: whoever builds it may name it something else, and the check stays quiet. That is a
 * false negative by design. What it makes impossible is the loud, repeated failure — a document
 * insisting something is unbuilt while the function sits in the tree.
 *
 * ## Counts, added 2026-09-22
 *
 * The symbol check has a blind spot, and on 2026-09-22 every stale claim in `STATUS.md` was inside
 * it: **a number**. It said 1,945 tests (2,911), twelve checks (seventeen), nine jobs and then ten
 * (thirteen), eight Railway services (nine). None of those cites a symbol, so none was checked, and
 * every one of them had been true when it was written.
 *
 * A figure that can be derived from the repository is therefore written as a claim too:
 *
 *     <!-- status: count jobs 13 -->
 *     <!-- status: count checks 17 -->
 *     <!-- status: count screens 90 -->
 *
 * Only three, and only these three, because each is **exactly** derivable from one file — the `JOB`
 * registry, the `verify` script, and `route-walk`'s own route lists. A count that has to be
 * measured at runtime (tests, Railway services, rows in production) is deliberately NOT here: a
 * lint that guesses is worse than one that stays quiet, and this file already says in as many words
 * that such a figure is only as fresh as the last time somebody ran the query.
 *
 * Run: `node scripts/status-lint.mjs` (part of `pnpm verify` and CI).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — this repo lives under a directory with a space in its name.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every markdown file that is allowed to make one of these claims, plus the code comments. */
function docs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) docs(full, out);
    else if (/\.(md|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const MARKER = /status:\s*(built|not-built)\s+([^\s#]+)#([A-Za-z0-9_]+)/g;
const COUNT_MARKER = /status:\s*count\s+(jobs|checks|screens)\s+(\d+)/g;

/** Each derives its number from exactly one file, so the answer cannot be a guess. */
const COUNTERS = {
  jobs() {
    const block = readFileSync(join(ROOT, "packages/db/src/job-lease.ts"), "utf8")
      .match(/export const JOB = \{([\s\S]*?)\n\} as const;/);
    return block ? [...block[1].matchAll(/^\s*\w+:\s*"[^"]+"/gm)].length : null;
  },
  checks() {
    // Every step of `pnpm verify` except the test run itself — those are the checks, and `test` is
    // counted separately in the sentence beside this number.
    const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    if (!scripts?.verify) return null;
    return scripts.verify.split("&&").map((s) => s.trim()).filter((s) => s && s !== "pnpm test").length;
  },
  screens() {
    const src = readFileSync(join(ROOT, "scripts/route-walk.mjs"), "utf8");
    const apps = [...src.matchAll(/routes:\s*\[([\s\S]*?)\n\s*\]/g)];
    return apps.length === 0 ? null : apps.reduce((n, [, body]) => n + (body.match(/"/g) ?? []).length / 2, 0);
  },
};

const files = docs(ROOT);
const failures = [];
let claims = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (!src.includes("status:")) continue;
  for (const m of src.matchAll(MARKER)) {
    const [, verdict, path, symbol] = m;

    /*
     * ⚠️ An indented marker is an EXAMPLE, not a claim.
     *
     * The convention is documented with two sample markers, inside an indented block — and this
     * lint promptly counted them as real claims about the codebase. The `not-built` one names a
     * function nobody has written; the day somebody writes it, the lint would have failed on its
     * own documentation and the fix would have been to edit the explanation.
     *
     * Third time today a check here matched its own prose: a11y-lint read the words "outline-none"
     * in a comment, layout-guard-lint anchored on "{children}" inside its own explanation. A lint
     * that cannot tell code from writing about code fails exactly when somebody is writing about it.
     */
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    if (/^(\s{4,}|>|\s*\*\s)/.test(src.slice(lineStart, m.index))) continue;
    claims++;
    const target = join(ROOT, path);
    const rel = file.slice(ROOT.length + 1);

    if (!existsSync(target)) {
      // A citation pointing at nothing cannot be checked, and an unverifiable claim is the thing
      // this exists to stop. `not-built` is allowed to name a file that does not exist yet.
      if (verdict === "built") failures.push(`${rel} claims ${symbol} is BUILT, but ${path} does not exist`);
      continue;
    }

    // Declared, not merely mentioned: the symbol has to be exported or defined, so that a claim
    // cannot be satisfied by the word appearing in a comment about it.
    const code = readFileSync(target, "utf8");
    const declared = new RegExp(
      `(export\\s+(async\\s+)?(function|const|class|interface|type)\\s+${symbol}\\b` +
      `|export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}` +
      `|(async\\s+)?function\\s+${symbol}\\s*\\()`,
    ).test(code);

    if (verdict === "built" && !declared) {
      failures.push(`${rel} claims ${symbol} is BUILT — it is not declared in ${path}`);
    }
    if (verdict === "not-built" && declared) {
      failures.push(`${rel} says ${symbol} is NOT BUILT — but it is declared in ${path}`);
    }
  }

  for (const m of src.matchAll(COUNT_MARKER)) {
    const [, what, stated] = m;
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    if (/^(\s{4,}|>|\s*\*\s)/.test(src.slice(lineStart, m.index))) continue;
    claims++;
    const actual = COUNTERS[what]();
    const rel = file.slice(ROOT.length + 1);
    if (actual === null) {
      failures.push(`${rel} counts ${what}, but the source it derives from could not be parsed — the check is blind`);
    } else if (actual !== Number(stated)) {
      failures.push(`${rel} says there are ${stated} ${what} — there are ${actual}`);
    }
  }
}

for (const f of failures) console.log(`  ${f}`);
console.log(`status-lint: ${claims} cited claim(s) checked against the code, ${failures.length} wrong.`);
if (failures.length > 0) {
  console.error(
    "\nstatus-lint FAILED.\n" +
      "A document is describing code that does not match it. Five claims in these files were wrong\n" +
      "in three days, every one of them work recorded as open that had already shipped — two of them\n" +
      "nearly cost duplicate work. A COUNT that disagrees is the same failure with a number.\n" +
      "Fix the sentence, not the marker.",
  );
  process.exit(1);
}
