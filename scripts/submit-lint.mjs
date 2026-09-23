#!/usr/bin/env node
/**
 * A form that CREATES something must not accept a second press while the first is running.
 *
 * ## Why this exists
 *
 * On 2026-09-09 the demo hotel checked "Maria Ivanova" in twice, 1.2 seconds apart, into rooms 101
 * and 102, with two folios. Nothing raced: the walk-in form had a plain `<button type="submit">`,
 * the action is slow enough (guest, reservation, room, folio, register entry, channel push) that the
 * screen sits unchanged, and a person's next move is to press again. The second press was a second
 * guest. Reproduced on 2026-09-23 by pressing twice, 150 ms apart.
 *
 * `@revio/ui/submit-button` already existed for exactly this — it disables itself while the action
 * runs and says what it is doing — and was used on 8 of 211 forms. The folio's "record payment",
 * "post charge" and "issue invoice" were among the 43 that did not: a double press there is a guest
 * charged twice, or two numbers from a series that must have no gaps.
 *
 * ## What it checks, and what it deliberately does not
 *
 * Only forms whose action NAME says it creates, posts, issues or sends — where a second press is a
 * second record. An update pressed twice writes the same value twice; that is not this defect. A
 * submit button with its own `onClick` is skipped: it is doing something bespoke (a confirm step)
 * that a blanket rule should not override.
 *
 * ⚠️ This closes the HUMAN double-press on a hydrated page. It does not close two tabs, a network
 * retry, or a press before React has hydrated — measured: pressed within the first moment of a
 * cold dev load, two walk-ins still went through. Those need an idempotency key on the server,
 * written up in docs/HANDOFF-2026-09-22.md.
 *
 * Run: `node scripts/submit-lint.mjs` (part of `pnpm verify` and CI).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const CREATES = /^(create|add|new|walkIn|issue|send|start|record|post|confirm|book|invite|generate|import|charge|convert|checkIn|checkOut|split|duplicate|request|submit|grant|open|capture|refund|use[A-Z])/;
const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

const found = [];
let forms = 0;
function walk(dir) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) scan(p);
  }
}
function scan(p) {
  const src = readFileSync(p, "utf8");
  for (const m of src.matchAll(/<form\s+action=\{(\w+)\}[\s\S]*?<\/form>/g)) {
    forms++;
    if (!CREATES.test(m[1])) continue;
    for (const b of m[0].matchAll(/<button\b[^>]*?type="submit"[^>]*>/g)) {
      if (/onClick/.test(b[0])) continue;
      found.push(`${relative(".", p)} → ${m[1]}`);
    }
  }
}
for (const a of APPS) for (const d of [`apps/${a}/app`, `apps/${a}/components`]) if (existsSync(d)) walk(d);

if (forms === 0) {
  console.error("submit-lint: found ZERO forms — the check is blind, which is a silent pass.");
  process.exit(1);
}
if (found.length === 0) {
  console.log(`submit-lint: ${forms} forms — every one that creates something refuses a second press while it runs.`);
  process.exit(0);
}
console.error("submit-lint FAILED: a form that creates something accepts a second press.\n");
for (const f of found) console.error(`  ${f}`);
console.error(
  "\nUse `<SubmitButton>` from \"@revio/ui/submit-button\" instead of `<button type=\"submit\">`." +
    "\nIt disables itself while the action runs and shows `pendingLabel`. It carries name, value," +
    "\ntitle, formAction, disabled and aria-label.",
);
process.exit(1);
