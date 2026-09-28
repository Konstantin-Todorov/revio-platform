#!/usr/bin/env node
/**
 * A form whose action can REFUSE must not wipe what was typed when it does.
 *
 * ## Why this exists
 *
 * React 19 resets a `<form action={fn}>` after the action finishes without throwing — and a refusal
 * returned as `{ ok: false, error }` does not throw. So every `useActionState` form cleared itself at
 * the moment it said what was wrong. On 2026-09-26 two colleagues filled in the Operator's whole
 * "new client" form, were told the owner email was taken, found every field empty, and gave up.
 *
 * `ActionForm` (`@revio/ui/action-form`) keeps the values on a refusal. This check fails when a
 * `<form>` is given an action that comes from `useActionState` — use `<ActionForm … state={…}>`.
 *
 * Plain `<form action={serverAction}>` without `useActionState` is not flagged: those actions report
 * through a redirect or a flash, and the page reloads either way.
 *
 * Run: `node scripts/actionform-lint.mjs` (part of `pnpm verify` and CI).
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps/reservation", "apps/channel-manager", "apps/pms", "apps/operator", "apps/booking", "packages/ui/src"]
  .flatMap((r) => (r.startsWith("apps/") ? [`${r}/app`, `${r}/components`] : [r]));

const found = [];
let files = 0;
let actionForms = 0;
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
  if (!src.includes("useActionState")) return;
  files++;
  const actions = new Set();
  for (const m of src.matchAll(/\[\s*\w+\s*,\s*(\w+)\s*(?:,\s*\w+\s*)?\]\s*=\s*useActionState/g)) actions.add(m[1]);
  actionForms += (src.match(/<ActionForm\b/g) ?? []).length;
  for (const m of src.matchAll(/<form\b[^>]*?\baction=\{(\w+)\}/g)) {
    if (actions.has(m[1])) found.push(`${relative(".", p)} → <form action={${m[1]}}>`);
  }
}
for (const r of ROOTS) if (existsSync(r)) walk(r);

if (files === 0 || actionForms === 0) {
  console.error("actionform-lint: found no useActionState forms — the check is blind, which is a silent pass.");
  process.exit(1);
}
if (found.length === 0) {
  console.log(`actionform-lint: ${actionForms} ActionForms in ${files} files — no form wipes what was typed when its action refuses.`);
  process.exit(0);
}
console.error("actionform-lint: these forms clear themselves when the server refuses — use <ActionForm action={…} state={…}> from @revio/ui/action-form:\n");
for (const f of found) console.error("  " + f);
process.exit(1);
