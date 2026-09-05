/**
 * The invented-health ratchet.
 *
 * All three September founder documents describe one fault in three products: **screens that report
 * health they have not verified.** A green pill over a channel that last synced 65 days ago. "Queue
 * empty" above a queue of ten. `0 Failed Syncs · Clear` where nothing was attempted. `100%` beside
 * 25 open errors. "All mapped" while a room type had never reached the channel at all.
 *
 * > ⚠️ **A zero from success and a zero from silence must never render the same.**
 *
 * Every one of those was a *literal* — copy written for the good case and rendered whenever the bad
 * case failed to be counted. That is the shape this lint looks for: a **health claim** hardcoded
 * inside a success-toned pill, rather than derived from something that measured it.
 *
 * `@revio/core/metrics/sync-health.ts` exists to derive them (`syncRecencyHealth`, `failureVerdict`,
 * `pendingSubtitle`, `successRate`) and returns `idle` and `unknown` precisely because those are the
 * two states screens kept collapsing into green.
 *
 * ## What is NOT a health claim
 *
 * "Settled", "Replied", "primary", "complete", "acked", "active" are **facts** about a row, not
 * assertions that a system is working. They stay literal and are not counted. The vocabulary below
 * is deliberately short for that reason — a lint that flags facts gets switched off.
 *
 * ## The escape hatch, and when it is honest
 *
 * A literal IS correct when something else already proved the claim — `mapping/page.tsx` renders
 * "All mapped" only after checking both incomplete rows AND products that were never sent. Say so:
 *
 *     {/* health-lint: guarded above by `incomplete` AND `neverSent` * /}
 *     <StatusPill tone="success">All mapped</StatusPill>
 *
 * The reason is the point. "health-lint: ok" is not a reason and will be argued with in review.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

/** Ratchet. Lower this when you derive one; never raise it. */
const BUDGET = 0;

/**
 * Claims that something is WORKING. Not states of a row.
 * Kept short on purpose: every word here must be indefensible as a hardcoded literal.
 */
const CLAIMS = [
  "live", "healthy", "all mapped", "all delivered", "queue empty", "up to date",
  "synced", "no errors", "all good", "nothing to sync", "operational", "all clear",
];

function walk(dir, out = [], ext = /\.tsx$/) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out, ext);
    // Rule 2 has to read data loaders, which are `.ts` — the fallback it exists to catch was in one.
    else if (ext.test(full)) out.push(full);
  }
  return out;
}

const files = APPS.flatMap((a) => walk(`apps/${a}/app`).concat(walk(`apps/${a}/components`)));
if (files.length === 0) {
  console.error("health-lint: scanned ZERO files — the glob is wrong, which is a silent pass.");
  process.exit(1);
}

const found = [];
// A success pill whose children start with a literal (not `{`).
const PILL = /<StatusPill[^>]*tone=(?:"success"|\{\s*"success"\s*\})[^>]*>\s*([A-Za-z][^<{]{0,40})/g;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  let m;
  PILL.lastIndex = 0;
  while ((m = PILL.exec(src)) !== null) {
    const text = m[1].trim().toLowerCase();
    if (!CLAIMS.some((c) => text.startsWith(c))) continue;
    const line = src.slice(0, m.index).split("\n").length;
    // An explicit, reasoned acknowledgement in the few lines above is the allowed form.
    const near = lines.slice(Math.max(0, line - 6), line).join("\n");
    if (/health-lint:\s*\S+/.test(near)) continue;
    found.push(`${file}:${line}  ${m[1].trim().slice(0, 50)}`);
  }
}

/*
 * Rule 2: an ATTEMPT timestamp passed where a SUCCESS is expected.
 *
 * `Channel.lastSyncAt` is stamped before the response is read, so it records that we tried, not
 * that it worked. `syncRecencyHealth`'s parameter is named `lastSuccessAt` precisely because the
 * distinction is the whole point — a channel failing every five minutes has a very recent attempt.
 *
 * Both known instances were live at once and neither was caught by rule 1, because neither wrote a
 * literal: one passed the column straight in, the other reached it through a `?? max(lastSyncAt)`
 * fallback that had been added back under the very query written to remove it. A name-level rule
 * catches the shape wherever it reappears.
 *
 * Scans lib/ too — the fallback that caused this lived in a data loader, not in a screen.
 */
const SUCCESS_ARG = /syncRecencyHealth\(([^),]*)/g;
const attemptIntoSuccess = [];
const libFiles = APPS.flatMap((a) => walk(`apps/${a}/lib`, [], /\.tsx?$/));
for (const file of [...files, ...libFiles]) {
  const src = readFileSync(file, "utf8");
  let m;
  SUCCESS_ARG.lastIndex = 0;
  while ((m = SUCCESS_ARG.exec(src)) !== null) {
    if (!/lastSyncAt/.test(m[1])) continue;
    const line = src.slice(0, m.index).split("\n").length;
    attemptIntoSuccess.push(`${file}:${line}  syncRecencyHealth(${m[1].trim().slice(0, 40)}…`);
  }
  // The fallback shape, wherever it is assembled rather than passed inline.
  for (const [i, l] of src.split("\n").entries()) {
    if (/\?\?[^\n]*lastSyncAt/.test(l) && /lastSuccess|lastSync\b/.test(src)) {
      attemptIntoSuccess.push(`${file}:${i + 1}  ${l.trim().slice(0, 60)}`);
    }
  }
}

if (attemptIntoSuccess.length > 0) {
  console.error("health-lint FAILED: an ATTEMPT timestamp is being read as a SUCCESS.\n");
  for (const f of attemptIntoSuccess) console.error(`  ${f}`);
  console.error(
    "\n`Channel.lastSyncAt` is stamped before the result is read. A channel that fails every five" +
      "\nminutes has a recent one, and `syncRecencyHealth` would call it Live." +
      "\n\nDerive from a SyncEvent with status \"success\", and pass null when there is none —" +
      "\n\"Never synced\" is the true answer and reads correctly.",
  );
  process.exit(1);
}

for (const f of found) console.log(`  ${f}`);
console.log(`health-lint: ${found.length} hardcoded health claim(s) in ${files.length} screens (budget ${BUDGET}).`);
if (found.length > BUDGET) {
  console.error(
    `\nhealth-lint FAILED: ${found.length} > budget ${BUDGET}.\n` +
      `Derive it from @revio/core/metrics/sync-health, or state why the literal is already proven:\n` +
      `  {/* health-lint: guarded above by ... */}`,
  );
  process.exit(1);
}
