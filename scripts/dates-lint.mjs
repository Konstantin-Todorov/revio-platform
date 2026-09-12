#!/usr/bin/env node
/**
 * Every date input declares which way it may look.
 *
 * ## The defect
 *
 * A restriction, a bulk price, a calendar cell and an out-of-order period all commit inventory that
 * has not happened yet, and every one of them would accept yesterday. Two of them defaulted TO
 * yesterday: they derived "today" from `new Date().toISOString()`, which is the server's UTC day,
 * and a Bulgarian hotel is UTC+3 — so from midnight to 03:00 local, every night, the screens opened
 * on a date that had already gone. That is the night auditor's shift.
 *
 * But a report that cannot look at last month is as broken as a calendar that can sell yesterday,
 * so this is not a blanket "no past dates" rule and a lint that enforced one would be wrong. It
 * enforces something narrower and more useful: **a date field must have DECIDED**. Carry a `min`,
 * carry a `max`, or be listed below with a reason.
 *
 * The four intents and which screens take which are documented in
 * `packages/core/src/stays/past-dates.ts`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/channel-manager", "apps/reservation", "apps/pms", "apps/operator", "apps/booking", "packages/ui/src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "test", "__tests__"]);

/**
 * Date fields that deliberately carry neither `min` nor `max`, and why.
 *
 * Every entry is a decision. An exemption without a reason is indistinguishable from something that
 * was forgotten — which is exactly how the rate screens ended up able to write into last week.
 */
const OPEN_ENDED = {
  // --- history: these READ the past, which is the whole point of them.
  "apps/reservation/app/(protected)/reservations/page.tsx:from": "reservation search — last month's bookings are the common case",
  "apps/reservation/app/(protected)/reservations/page.tsx:to": "reservation search — see above",
  "apps/reservation/components/dashboard/DashboardView.tsx:from": "dashboard custom range — a report that cannot look back is not a report",
  "apps/reservation/components/dashboard/DashboardView.tsx:to": "dashboard custom range — see above",
  "apps/channel-manager/app/(protected)/reservations/page.tsx:from": "channel booking monitor — reads what already arrived",
  "apps/channel-manager/app/(protected)/reservations/page.tsx:to": "channel booking monitor — see above",
  "packages/ui/src/activity-table.tsx:from": "audit log and sync history — both are records of what happened",
  "packages/ui/src/activity-table.tsx:to": "audit log and sync history — see above",
  "apps/operator/components/clients/AccountPanel.tsx:renewalDate":
    "a contract date recorded after the fact is normal, and a renewal in the past is meaningful — it means lapsed",
};

const files = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.tsx$/.test(p) && !/\.test\.tsx$/.test(p)) files.push(p);
  }
}
for (const r of ROOTS) walk(r);

/** The element's own attributes: from `<DateField` / `<input ... type="date"` to the closing `>`. */
function* dateElements(src) {
  const re = /<(DateField|input)\b/g;
  let m;
  while ((m = re.exec(src))) {
    // Walk to the end of the tag, respecting {…} so a className with a `>` inside does not end it.
    let i = m.index + m[0].length;
    let depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const attrs = src.slice(m.index, i);
    if (m[1] === "input" && !/type="date"/.test(attrs)) continue;
    yield { attrs, index: m.index };
  }
}

const undeclared = [];
const seen = new Set();
let checked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(process.cwd(), file);
  // The primitive itself and the document-level opener are plumbing: they render or target other
  // people's date fields and have no date of their own to bound.
  if (/packages\/ui\/src\/(date-field|date-picker-affordance|stay-range-field)\.tsx$/.test(rel)) continue;

  for (const { attrs, index } of dateElements(src)) {
    checked++;
    const name = /name="([^"]+)"/.exec(attrs)?.[1]
      ?? /(?:default)?[Vv]alue=\{([A-Za-z0-9_.]+)\}/.exec(attrs)?.[1]
      ?? "(unnamed)";
    const key = `${rel}:${name}`;
    seen.add(key);
    if (/\bmin=/.test(attrs) || /\bmax=/.test(attrs)) continue;
    if (key in OPEN_ENDED) continue;
    undeclared.push({ key, line: src.slice(0, index).split("\n").length });
  }
}

if (checked === 0) {
  console.error("dates-lint: 0 date fields were found — the scan is broken, not the code.");
  process.exit(2);
}

const stale = Object.keys(OPEN_ENDED).filter((k) => !seen.has(k));
if (stale.length > 0) {
  console.error("dates-lint: OPEN_ENDED lists fields that no longer exist:");
  for (const k of stale) console.error(`  ${k} — remove it from scripts/dates-lint.mjs`);
  process.exit(1);
}

if (undeclared.length > 0) {
  console.error(`\ndates-lint: ${undeclared.length} date field(s) have not decided which way they look:\n`);
  for (const u of undeclared) console.error(`  ${u.key}  (line ${u.line})`);
  console.error(
    "\nA date field that commits future inventory — a rate, a restriction, an availability, a stay —\n" +
      "needs `min={...}`, and the floor must be TODAY AT THE PROPERTY: `todayInTimeZone(property.timezone)`,\n" +
      "never `new Date().toISOString()`, which is the server's UTC day and runs a day behind a\n" +
      "Bulgarian hotel until 03:00 every morning.\n\n" +
      "A field on an existing record uses `earliestSelectable(today, currentValue)` so a stay that has\n" +
      "already started stays editable. A field that reads backwards (a report, a search, a note about a\n" +
      "past call) belongs in OPEN_ENDED in scripts/dates-lint.mjs WITH A REASON. A date of birth takes\n" +
      "`max`, not `min`.\n\n" +
      "See packages/core/src/stays/past-dates.ts for the four intents.\n",
  );
  process.exit(1);
}

console.log(
  `dates-lint: ${checked} date fields · ${checked - Object.keys(OPEN_ENDED).length} bounded · ` +
    `${Object.keys(OPEN_ENDED).length} open-ended with a stated reason.`,
);
