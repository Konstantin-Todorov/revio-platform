#!/usr/bin/env node
/**
 * Pinch-zoom must never be locked, and form controls must stay 16px on touch.
 *
 * Two halves of one accessibility rule, each of which silently undoes the other.
 *
 * **1. No `maximum-scale=1` / `user-scalable=no`.** It is the first thing people reach for when a
 * phone zooms on focus, and it fails **WCAG 1.4.4 (Resize text)** — a guest who needs to magnify a
 * price on the booking page, or a housekeeper reading a room number, simply cannot. Newer iOS
 * ignores it anyway, so it breaks accessibility without even fixing the thing it was added for.
 *
 * **2. The real fix must stay present.** Safari zooms when a focused control is under 16px, so each
 * app's stylesheet raises controls to 16px on touch devices only. Delete that block and the zoom
 * comes back, and the next person reaches for the viewport lock again. This checks the block is
 * still there rather than trusting a comment to survive.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPS = readdirSync("apps");
const problems = [];

for (const app of APPS) {
  // --- 1. the viewport must not lock zoom ---
  for (const file of ["app/layout.tsx", "app/viewport.ts"]) {
    const path = join("apps", app, file);
    if (!existsSync(path)) continue;
    /*
     * Comments stripped first. The block that documents WHY the viewport must not be locked
     * naturally contains the string it is warning about, and the first run of this check flagged
     * all four apps for their own explanation. Same trap `a11y-lint` hit: a linter that reads prose
     * as code reports the documentation as the defect.
     */
    const src = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const locked =
      /maximumScale\s*:\s*1\b/.test(src) ||
      /userScalable\s*:\s*(false|"no")/.test(src) ||
      /user-scalable\s*=\s*no/.test(src) ||
      /maximum-scale\s*=\s*1\b/.test(src);
    if (locked) {
      problems.push(
        `${path}\n    Pinch-zoom is locked. This fails WCAG 1.4.4 and newer iOS ignores it anyway.\n` +
          `    If you are here because a phone zooms on focus, that is the 16px rule in globals.css — not this.`,
      );
    }
  }

  // --- 2. Chrome on Android must not boost text ---
  const cssPath = join("apps", app, "app", "globals.css");
  if (existsSync(cssPath) && !/text-size-adjust:\s*100%/.test(readFileSync(cssPath, "utf8"))) {
    problems.push(
      `${cssPath}\n    \`text-size-adjust: 100%\` is missing on <html>.\n` +
        `    Chrome on Android inflates font sizes in some layouts, which breaks the type scale and\n` +
        `    reads to a user as the page having zoomed itself.`,
    );
  }

  // --- 3. the iOS focus fix must still be there ---
  const css = join("apps", app, "app", "globals.css");
  if (!existsSync(css)) continue;
  const src = readFileSync(css, "utf8");
  const hasTouchQuery = /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/.test(src);
  const raisesControls = /font-size:\s*16px/.test(src);
  if (!hasTouchQuery || !raisesControls) {
    problems.push(
      `${css}\n    The touch-device 16px rule for form controls is missing.\n` +
        `    Without it iOS Safari zooms the page whenever a field takes focus, and the user is left\n` +
        `    zoomed in afterwards. See any other app's globals.css for the block and the reasoning.`,
    );
  }
}

if (problems.length === 0) {
  console.log(`zoom-lint: ${APPS.length} apps — zoom is unlocked and controls stay 16px on touch.`);
  process.exit(0);
}

console.error("zoom-lint FAILED:\n");
for (const p of problems) console.error(`  ${p}\n`);
process.exit(1);
