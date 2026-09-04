#!/usr/bin/env node
/**
 * `<html>` must keep `overflow: visible`, or every modal in the platform stops locking the page.
 *
 * ## The chain this defends
 *
 * The shell used to scroll on an inner `<main>`; it now scrolls the document natively. So
 * `useScrollLock` locks `document.body`, and that only freezes the viewport because of one CSS rule
 * most people have never read: the UA propagates overflow from `<html>` to the viewport, and falls
 * back to `<body>` ONLY while `<html>`'s own overflow is `visible`.
 *
 * Give `<html>` any overflow value — and `html { overflow-x: hidden }` is the single most common fix
 * for a horizontal-scroll bug on mobile — and propagation switches to `<html>`. `body.style.overflow
 * = "hidden"` then does nothing at all. Every dialog in every app silently stops holding the page,
 * and the symptom is the one that took a screenshot to diagnose last time: scroll to the bottom of a
 * long dialog, the wheel chains through to the page underneath, and closing it drops you somewhere
 * else entirely. It reads as "the layout broke". There is no error.
 *
 * The two halves are in different files, written by different people, months apart. That is what
 * this lint is for.
 *
 * `@media print` is exempt: print stylesheets deliberately unpick every scroll container, and there
 * are no dialogs on paper.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPS = join(process.cwd(), "apps");
const failures = [];

for (const app of readdirSync(APPS)) {
  const css = join(APPS, app, "app", "globals.css");
  if (!existsSync(css)) continue;

  const text = readFileSync(css, "utf8");
  const lines = text.split("\n");

  let printDepth = 0; // brace depth at which the enclosing @media print opened, 0 = not in one
  let depth = 0;
  let selector = null;
  let selectorDepth = 0;

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (/^@media[^{]*\bprint\b/.test(trimmed) && printDepth === 0) printDepth = depth + 1;

    // A selector is whatever precedes an opening brace on this line.
    const open = trimmed.indexOf("{");
    if (open >= 0 && !trimmed.startsWith("@")) {
      const head = trimmed.slice(0, open).trim();
      // `html`, `html.dark`, `html, body` — but never `html main` or `.x html`.
      const targetsHtml = head
        .split(",")
        .map((s) => s.trim())
        .some((s) => /^html(?![\w-])(?!.*\s)/.test(s));
      if (targetsHtml) {
        selector = head;
        selectorDepth = depth;
      }
    }

    if (selector !== null && printDepth === 0 && /(^|[;{\s])overflow(-x|-y)?\s*:/.test(trimmed)) {
      failures.push({
        file: `apps/${app}/app/globals.css`,
        line: i + 1,
        selector,
        text: trimmed,
      });
    }

    for (const ch of trimmed) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (selector !== null && depth <= selectorDepth) selector = null;
        if (printDepth > 0 && depth < printDepth) printDepth = 0;
      }
    }
  });
}

if (failures.length === 0) {
  console.log("scroll-lock-lint: 0 overflow declarations on <html> — modal scroll locking is intact.");
  process.exit(0);
}

console.error("scroll-lock-lint: <html> must keep overflow: visible.\n");
for (const f of failures) {
  console.error(`  ${f.file}:${f.line}  ${f.selector} { ${f.text} }`);
}
console.error(
  "\nAny overflow on <html> moves viewport-overflow propagation off <body>, and useScrollLock" +
    "\nlocks <body>. Every dialog would stop holding the page behind it, with no error.\n" +
    "\nTo fix a horizontal overflow, constrain the offending element (or the shell wrapper) instead." +
    "\nSee packages/ui/src/use-scroll-lock.tsx.",
);
process.exit(1);
