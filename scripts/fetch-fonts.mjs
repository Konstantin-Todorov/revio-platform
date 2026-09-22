#!/usr/bin/env node
/**
 * Bring the web fonts into the repository, so a build does not depend on reaching Google.
 *
 * ## Why
 *
 * `next/font/google` self-hosts the bytes it ships — at RUNTIME nothing calls Google, and that was
 * never the problem. The problem is that it fetches them **at build time, on every build**, and CI
 * has no Next cache ("⚠ No build cache found" on every run). So every deploy of all five apps
 * depends on fonts.googleapis.com answering.
 *
 * On 2026-09-22 it did not. `apps/pms` failed with `TypeError: Cannot read properties of null
 * (reading '1')` inside Next's Google font loader, CI went red, and `production` stopped at the
 * previous commit until a re-run went green. Nothing was wrong with the code. The marketing site
 * had the same dependency and it was removed the same day by self-hosting; this is that change for
 * the platform.
 *
 * ## What it takes, and what it deliberately does not
 *
 * The **variable** woff2 for each family — one file covering the whole weight range, rather than
 * five static weights — and only the `latin` and `latin-ext` subsets, which is exactly what the
 * layouts ask for today. Cyrillic is available and is NOT taken: nothing in the staff products is
 * in Bulgarian yet, and this change is about where the bytes come from, not about what renders.
 * When the products are localised, add it here and the fallback stops being reached.
 *
 * Run: `node scripts/fetch-fonts.mjs` — after changing a family, and never automatically. The files
 * are committed, which is the whole point: a build must not need the network to find them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A real browser UA, or Google serves the ancient TTF stylesheet instead of woff2. */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const WANTED = new Set(["latin", "latin-ext"]);

/** family → the apps that use it. One small file each; duplication beats a fragile relative path. */
const FAMILIES = [
  { css: "Hanken+Grotesk:wght@400..800", file: "hanken-grotesk", apps: ["channel-manager", "reservation", "pms", "operator"] },
  { css: "Plus+Jakarta+Sans:wght@400..800", file: "plus-jakarta-sans", apps: ["booking"] },
  { css: "Instrument+Serif:ital@0", file: "instrument-serif", apps: ["booking"] },
];

/**
 * Google's stylesheet is a run of `@font-face` blocks, each preceded by a comment naming the subset.
 * Splitting on that comment is what ties a url to the subset it serves — the block itself only
 * carries a unicode-range, and matching on that would break the day Google edits one.
 */
function urlsBySubset(css) {
  const out = new Map();
  for (const part of css.split("/*").slice(1)) {
    const subset = part.slice(0, part.indexOf("*/")).trim();
    const url = part.match(/src:\s*url\((https:[^)]+\.woff2)\)/)?.[1];
    if (subset && url) out.set(subset, url);
  }
  return out;
}

let written = 0;
for (const family of FAMILIES) {
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${family.css}&display=swap`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${family.css}: stylesheet ${res.status}`);
  const urls = urlsBySubset(await res.text());

  for (const subset of WANTED) {
    const url = urls.get(subset);
    if (!url) throw new Error(`${family.css}: no ${subset} subset — the family or the stylesheet changed`);
    const bytes = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    if (bytes.length < 1000) throw new Error(`${family.css} ${subset}: ${bytes.length} bytes is not a font`);
    for (const app of family.apps) {
      const dir = join("apps", app, "app", "fonts");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${family.file}-${subset}.woff2`), bytes);
      written++;
    }
    console.log(`  ${family.file}-${subset}.woff2  ${(bytes.length / 1024).toFixed(1)} KB → ${family.apps.join(", ")}`);
  }
}
console.log(`fetch-fonts: ${written} file(s) written. Commit them — a build must not need the network.`);
