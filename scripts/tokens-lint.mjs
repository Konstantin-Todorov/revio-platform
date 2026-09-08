#!/usr/bin/env node
/**
 * Every colour class we write must exist in every app that renders it.
 *
 * Tailwind resolves a class it does not know to **nothing at all**. No error, no warning, no build
 * failure — the element simply renders with no background, or no border, or invisible text, and the
 * only way to find out is to look at the page.
 *
 * That happened on 2026-09-08. The support thread's own message bubbles used `bg-brand-050`, because
 * `packages/ui/src/tokens.ts` writes the lightest shade as the string `"050"` while every app's
 * `tailwind.config.ts` registers it as `50`. Typecheck passed, 1,766 tests passed, eleven lints
 * passed, and the customer's own words rendered on no bubble.
 *
 * The failure is worse from `packages/ui`, which is why this check exists at all: a shared component
 * is rendered by four apps, so one wrong shade is wrong four times, and it is correct in none of the
 * places anybody would think to look.
 *
 * ## What it checks
 *
 * Every `<utility>-<scale>-<shade>` class in shared UI and app code, against the colours each app's
 * Tailwind config actually defines. Scales are matched by name, so a class naming a scale no config
 * has (a typo like `bg-brnd-800`) is caught too.
 *
 * Deliberately narrow. It reads literal class strings only: a class assembled at runtime is beyond
 * it, and Tailwind cannot see those either — which is a good reason not to write them.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

/** The utilities that take a colour. `ring`/`divide`/`from` included — all fail the same way. */
const UTILITIES = "bg|text|border|ring|divide|from|via|to|fill|stroke|outline|accent|caret|shadow|decoration|placeholder";

/**
 * Colour scales worth checking.
 *
 * Only the ones we define ourselves. Tailwind's own palette (slate, red, …) is always present, and
 * a project that used it would not have this bug.
 */
const OURS = new Set(["brand", "ink", "surface", "success", "warning", "danger", "info", "accent", "product"]);

/** `colors: { brand: { 900: "#…", 50: "#…" } }` out of a Tailwind config, without evaluating it. */
function definedShades(configSrc) {
  const shades = new Map();
  for (const scale of OURS) {
    // `scale: { … }` — the first balanced-looking block after the name.
    const m = new RegExp(`\\b${scale}:\\s*\\{([^}]*)\\}`).exec(configSrc);
    if (!m) continue;
    const keys = new Set();
    for (const k of m[1].matchAll(/(?:^|[,{\s])["']?([A-Za-z0-9_]+)["']?\s*:/g)) keys.add(k[1]);
    shades.set(scale, keys);
  }
  return shades;
}

function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const configs = new Map();
for (const app of APPS) {
  const path = `apps/${app}/tailwind.config.ts`;
  if (!existsSync(path)) {
    console.error(`tokens-lint: ${path} is missing — the check would be blind, which is a silent pass.`);
    process.exit(1);
  }
  configs.set(app, definedShades(readFileSync(path, "utf8")));
}

if ([...configs.values()].every((c) => c.size === 0)) {
  console.error("tokens-lint: parsed ZERO colour scales out of every config — the check is blind.");
  process.exit(1);
}

const CLASS = new RegExp(`\\b(?:${UTILITIES})-([a-z]+)-([A-Za-z0-9]+)\\b`, "g");

/** Shared UI is checked against EVERY app, because every app renders it. */
const targets = [
  { files: sourceFiles("packages/ui/src"), apps: APPS, where: "@revio/ui" },
  ...APPS.map((a) => ({
    files: [...sourceFiles(`apps/${a}/app`), ...sourceFiles(`apps/${a}/components`)],
    apps: [a],
    where: a,
  })),
];

const problems = [];
let scanned = 0;

for (const target of targets) {
  for (const file of target.files) {
    scanned++;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(CLASS)) {
      const [cls, scale, shade] = [m[0], m[1], m[2]];
      if (!OURS.has(scale)) continue;
      for (const app of target.apps) {
        const defined = configs.get(app)?.get(scale);
        if (!defined) {
          problems.push(`${file}  ${cls}  →  apps/${app} defines no "${scale}" scale`);
        } else if (!defined.has(shade)) {
          problems.push(
            `${file}  ${cls}  →  apps/${app} has ${scale}: ${[...defined].join(", ")}`,
          );
        }
      }
    }
  }
}

const unique = [...new Set(problems)];
if (unique.length === 0) {
  console.log(`tokens-lint: ${scanned} files — every colour class resolves in every app that renders it.`);
  process.exit(0);
}

console.error("tokens-lint FAILED: colour class(es) that Tailwind will resolve to nothing.\n");
for (const p of unique.slice(0, 40)) console.error(`  ${p}`);
if (unique.length > 40) console.error(`  … and ${unique.length - 40} more`);
console.error(
  "\nTailwind emits no CSS for a class it does not know and says nothing about it, so the element" +
    "\nrenders with no background, no border or invisible text. Use a shade the config defines — and" +
    "\nnote that tokens.ts writes the lightest one as \"050\" while the configs register it as 50.",
);
process.exit(1);
