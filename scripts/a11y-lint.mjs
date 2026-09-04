/**
 * The invisible-focus ratchet.
 *
 * A count across the five apps found **two** `focus-visible` treatments against **1,203**
 * interactive elements. A keyboard user could not see where they were anywhere in the product —
 * an accessibility defect in software whose users work a front desk at speed, often without a
 * mouse, and one that also happens to be why clicking things felt dead.
 *
 * That is now fixed once, globally, in each app's `globals.css`:
 *
 *   :focus-visible                          → a 2px outline (follows border-radius, and unlike a
 *                                             shadow it cannot replace an elevation a component
 *                                             already paints)
 *   input/select/textarea:focus-visible     → a box-shadow ring AS WELL
 *   summary:focus-visible                   → painted on the summary, not the <details> wrapper
 *
 * ## What this lint actually protects
 *
 * The base-layer outline is beaten by any utility, so **`outline-none` silently switches the ring
 * back off**. That is the single edit that undoes the fix, and it is an easy one to make: it is what
 * you reach for when a default outline looks wrong, and nothing on screen tells you what you removed.
 *
 * Fields are exempt because the shadow ring survives `outline-none` — it is a different property.
 * Everything else is not.
 *
 * ## The escape hatch, and when it is honest
 *
 * `outline-none` IS correct when the element paints its own, better-fitting ring — an inset shadow
 * on a table header, a ring in the control's own tone. Say so, and say which:
 *
 *     {/* a11y-lint: focus shown by focus-visible:shadow-focus below * /}
 *     <button className="outline-none focus-visible:shadow-focus">
 *
 * A treatment in the same className is detected automatically and needs no comment. The comment is
 * for the case where the ring is painted from somewhere else. "a11y-lint: ok" is not a reason and
 * will be argued with in review.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

/** Ratchet. Lower this when you give one its own ring; never raise it. */
const BUDGET = 0;

/**
 * Markers that make an `outline-none` acceptable, checked against the class string it sits in.
 *
 * Working on the class string rather than the JSX tag is deliberate: most of these live in shared
 * constants (`const INPUT = "... outline-none ..."`) with no tag anywhere near them, and a
 * scan-backwards-for-`<` approach lands on the `<` of a generic type parameter instead.
 *
 * Fields keep their ring through `outline-none` because theirs is a box-shadow — a different
 * property, which the utility does not touch. They are detected two ways: the `placeholder:` utility,
 * and (below) the nearest preceding tag name, since most field classes are shared constants written
 * nowhere near their element.
 */
const ACCEPTABLE = [
  /focus-visible:/,        // its own explicit ring
  /focus:ring/,
  /focus:shadow/,
  /focus-within:ring/,
  /placeholder:/,          // a field — covered by the global box-shadow ring
  /focus:border/,          // changes on focus, and on a field also carries the shadow ring
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

const files = APPS.flatMap((a) => walk(`apps/${a}/app`).concat(walk(`apps/${a}/components`)))
  .concat(walk("packages/ui/src"));

if (files.length === 0) {
  console.error("a11y-lint: scanned ZERO files — the glob is wrong, which is a silent pass.");
  process.exit(1);
}

/**
 * The string literal containing `index` — the class string, wherever it is written.
 *
 * Walks outward to the nearest enclosing quote or backtick. Returns null when the match is not
 * inside a string at all, which is how a stray identifier gets skipped rather than mis-blamed.
 */
function enclosingString(src, index) {
  for (const q of ['"', "'", "`"]) {
    const open = src.lastIndexOf(q, index);
    if (open === -1) continue;
    const close = src.indexOf(q, index);
    if (close === -1) continue;
    // Only accept when the quotes actually bracket the match and hold no newline-heavy gap.
    const text = src.slice(open + 1, close);
    if (text.includes("outline-none") && text.split("\n").length <= 4) return text;
  }
  return null;
}

/**
 * The element a class string is applied to, found by the nearest preceding tag name.
 *
 * Bounded to a short window so a match cannot be blamed on an unrelated element far above it, and
 * the tag list is explicit so `Record<string, …>` and other generics can never be mistaken for JSX
 * — which is exactly what a naive scan back to the previous `<` does.
 */
const TAG = /<\s*(input|select|textarea|button|a|summary|form|label|div|span|li|td|th)\b/gi;
function nearestTag(src, index) {
  const from = Math.max(0, index - 700);
  const window = src.slice(from, index);
  let last = null, m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(window)) !== null) last = m[1].toLowerCase();
  return last;
}

/** Their ring is a box-shadow, which `outline-none` does not touch. */
const FIELDS = new Set(["input", "select", "textarea"]);

const found = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const re = /\boutline-none\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const cls = enclosingString(src, m.index);
    if (!cls) continue;
    if (ACCEPTABLE.some((r) => r.test(cls))) continue;
    if (FIELDS.has(nearestTag(src, m.index))) continue;

    const line = src.slice(0, m.index).split("\n").length;
    const near = lines.slice(Math.max(0, line - 6), line).join("\n");
    if (/a11y-lint:\s*\S+/.test(near)) continue;

    found.push(`${file}:${line}  removes the focus ring with nothing in its place`);
  }
}

for (const f of found) console.log(`  ${f}`);
console.log(`a11y-lint: ${found.length} element(s) with an invisible focus state across ${files.length} files (budget ${BUDGET}).`);
if (found.length > BUDGET) {
  console.error(
    `\na11y-lint FAILED: ${found.length} > budget ${BUDGET}.\n` +
      `Drop the \`outline-none\` and let the global ring apply, give the element its own\n` +
      `\`focus-visible:\` treatment, or state where the ring comes from:\n` +
      `  {/* a11y-lint: focus shown by ... */}`,
  );
  process.exit(1);
}
