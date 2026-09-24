#!/usr/bin/env node
/**
 * Bans the Bulgarian terms that were decided against — in the products, as on the website.
 *
 * The list is the marketing site's (`revio-websites/scripts/terminology.mjs`), copied rather than
 * imported because the two are separate repositories; keep them in step. These are founder decisions
 * about how Revio speaks to its market, and the one that matters most is the one a translator
 * reaches for by default: the borrowing for "channel manager" is rejected — **канален мениджър**.
 *
 * Written BEFORE the first product screen was translated (2026-09-24), because a translation pass
 * across thousands of strings reintroduces a banned phrase unless the check exists first.
 *
 * Scans every .ts/.tsx under apps/ and packages/. A line that must NAME a banned term (a glossary,
 * this kind of warning) carries `terminology:allow`.
 *
 * Run: node scripts/terminology-lint.mjs   (part of `pnpm verify` and CI)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED = [
  ["чанъл мениджър", "канален мениджър"], // terminology:allow
  ["чанъл-мениджър", "канален мениджър"], // terminology:allow
  ["тарифен план", "ценови план"], // terminology:allow
  ["тарифни планове", "ценови планове"], // terminology:allow
  ["букинг енджин", "система за директни резервации"], // terminology:allow
  ["камериерски отдел", "хаускийпинг"], // terminology:allow
  ["свободни стаи", "наличност"], // terminology:allow
];
const ALLOW = "terminology:allow";
const SKIP = new Set(["node_modules", ".next", "dist", "coverage", ".turbo"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

const hits = [];
let files = 0;
for (const root of ["apps", "packages"]) {
  for (const file of walk(root)) {
    files++;
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.includes(ALLOW)) return;
      const low = line.toLowerCase();
      for (const [bad, good] of BANNED) if (low.includes(bad)) hits.push(`${file}:${i + 1}  "${bad}" → "${good}"`);
    });
  }
}
if (hits.length) {
  console.error(`terminology-lint FAILED — ${hits.length} rejected Bulgarian term(s):\n` + hits.map((h) => `  ${h}`).join("\n"));
  process.exit(1);
}
console.log(`terminology-lint: ${files} files, no rejected Bulgarian terms.`);
