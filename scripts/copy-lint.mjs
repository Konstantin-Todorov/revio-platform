#!/usr/bin/env node
/**
 * Copy lint — catches our vocabulary escaping into text a hotel reads.
 *
 * `docs/COPY.md` is a convention, and a convention with no check is a document people stop
 * remembering. This is the mechanical half: it cannot judge whether a subtitle helps someone decide
 * something (rule 4 of the doc is a human call), but it can prove we never again ship the name of an
 * environment variable, a package path, or the word "mock" to a hotelier — which is exactly what the
 * first pass found.
 *
 * Scope: the four STAFF apps. `apps/booking` is excluded on purpose — it is guest-facing, wears the
 * hotel's brand, and keeps a warmer voice. Shared guest-facing copy in `packages/core/src/email` is
 * included, because a hotel edits those templates.
 *
 *   node scripts/copy-lint.mjs          # report and exit 1 on any finding
 *   node scripts/copy-lint.mjs --list   # report and always exit 0
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the latter percent-encodes, and this repo lives under a directory
// with a space in its name. The first version of this script used .pathname, so every readdir failed,
// every failure was swallowed, and it cheerfully reported "clean" having scanned nothing at all.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const TARGETS = [
  "apps/channel-manager",
  "apps/reservation",
  "apps/pms",
  "apps/operator",
  "packages/core/src/email",
  "packages/ui/src",
];

/**
 * Words that are never right in front of a hotel.
 *
 * Deliberately narrow. A broad list would flag legitimate hotel vocabulary ("rate plan", "folio")
 * and get switched off, which is worse than a short list nobody argues with.
 */
const BANNED = [
  // our infrastructure
  [/\bRESEND_API_KEY|AUTH_SECRET|DATABASE_URL|CRON_SECRET|STRIPE_[A-Z_]{2,}\b/, "names an environment variable"],
  [/\b@revio\/[a-z-]+|packages\/[a-z-]+\b/, "names a package path"],
  [/\bprisma\b/i, "names the database layer"],
  // our vocabulary for our own design
  [/\bmock(ed|s)?\b/i, "say “test” — see the vocabulary table in docs/COPY.md"],
  [/\bwaterfall\b|\bprecedence model\b|\bsource of truth\b|\bARI push\b/i, "names an internal concept"],
  [/§\s?\d/, "cites a spec section"],
  // work we have not done
  [/\bfor the demo\b|\bdemo (only|mode)\b|\bnot yet implemented\b|\bcoming soon\b/i, "references unfinished work"],
  [/\bTODO\b|\bFIXME\b|\blorem ipsum\b/i, "developer placeholder"],
];

/** Strings a person actually reads: JSX text, and the props that render as text. */
const VISIBLE = [
  /<[^>]*>\s*([^<>{}\n]{6,200})\s*</g,
  /(?:placeholder|title|label|aria-label|subtitle|lead|body|description|hint|note|cta)\s*=\s*"([^"]{6,300})"/g,
  /(?:placeholder|title|label|subtitle|lead|body|description|hint|note|cta)\s*:\s*"([^"]{6,300})"/g,
];

async function* walk(dir, isTarget = false) {
  let entries;
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  } catch (err) {
    // A directory we were told to scan and cannot read is a broken lint, not an empty one. Only
    // nested directories may vanish silently (a stale path inside a tree is harmless).
    if (isTarget) throw new Error(`copy-lint cannot read target "${dir}": ${err.message}`);
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield p;
  }
}

const findings = [];
let scanned = 0;

for (const target of TARGETS) {
  for await (const file of walk(target, true)) {
    scanned++;
    const src = readFileSync(join(ROOT, file), "utf8");
    const lines = src.split("\n");

    for (const pattern of VISIBLE) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(src))) {
        const text = m[1].trim();
        const lineNo = src.slice(0, m.index).split("\n").length;
        const raw = lines[lineNo - 1] ?? "";
        // Comments explain our reasoning to us; they are not shipped.
        if (/^\s*(\/\/|\*|\/\*)/.test(raw)) continue;
        // className soup is not prose.
        if (/className|classNames|clsx|cn\(/.test(text) || /^[a-z-]+:[a-z0-9[\]/.-]+/.test(text)) continue;

        for (const [re, why] of BANNED) {
          if (re.test(text)) {
            findings.push({ file, lineNo, text: text.slice(0, 120), why });
            break;
          }
        }
      }
    }
  }
}

const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.text}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// A scan of nothing is not a pass. The first version of this script silently walked zero files and
// reported clean, so the count is printed and an empty scan is a hard failure.
if (scanned === 0) {
  console.error("copy-lint: scanned 0 files — the scan is broken, not the copy.");
  process.exit(2);
}

if (unique.length === 0) {
  console.log(`copy-lint: clean — ${scanned} files, no internal vocabulary in user-visible strings.`);
  process.exit(0);
}

for (const f of unique) {
  console.log(`${relative(".", f.file)}:${f.lineNo}  ${f.why}`);
  console.log(`    ${f.text}`);
}
console.log(`\ncopy-lint: ${unique.length} finding${unique.length === 1 ? "" : "s"}. See docs/COPY.md.`);
process.exit(process.argv.includes("--list") ? 0 : 1);
