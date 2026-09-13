/**
 * A protected layout must REFUSE BY REDIRECT, never by returning a screen.
 *
 * ## The bug this exists for
 *
 * Refusing access by returning a "no access" component instead of `{children}` looks completely
 * right and is not. In the Next App Router the page segment renders **independently of what the
 * layout returns**: dropping `{children}` changes the HTML, and Next still executes the page and
 * streams it into the RSC flight payload. The refusal screen is on top of a full response body.
 *
 * Measured on 2026-09-14, on RevioPMS, twice:
 *
 * - a `distribution_manager` refused by role got 208 KB containing a real guest's name;
 * - a hotel with `hasPms = false` refused by entitlement got 211 KB containing the same.
 *
 * Both now `redirect()`, which throws and stops the render, and both responses fell to ~35–42 KB
 * with nothing of the hotel's book in them. That is the whole rule:
 *
 *   **A conditional `return` of JSX before `{children}` in a protected layout is a data leak.**
 *
 * ⚠️ This checks the SHAPE, not the decision. Whether the right people are refused is what
 * `read-scope.test.ts` and the entitlement tests are for. What this guarantees is that a refusal,
 * once decided, actually stops the render — which is the half that was wrong while every test in the
 * repository was green.
 *
 * Run: `node scripts/layout-guard-lint.mjs` (part of `pnpm verify` and CI).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — this repo lives under a directory with a space in its name.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["channel-manager", "reservation", "pms", "operator"];


/**
 * Blank out comments, preserving every newline so reported line numbers stay true.
 *
 * ⚠️ Not optional, and not tidiness. The first version read the raw source and anchored on the first
 * `{children}` it found — which was the one inside this very file's own explanatory comment, four
 * lines into the guard section. It then measured a guard section of nothing, reported zero, and went
 * green on a layout with the leak deliberately put back. A lint that reads prose as code is a lint
 * that passes when it matters.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

const found = [];
let checked = 0;

for (const app of APPS) {
  const file = join(ROOT, "apps", app, "app", "(protected)", "layout.tsx");
  if (!existsSync(file)) continue;
  checked++;
  const src = stripComments(readFileSync(file, "utf8"));

  // Where the layout finally renders the page. Everything before this point is the guard section.
  const childrenAt = src.indexOf("{children}");
  if (childrenAt === -1) {
    found.push(`apps/${app} — layout never renders {children}`);
    continue;
  }

  /*
   * The guard section ends at the layout's MAIN return — the one that renders {children} — not at
   * {children} itself. The first version sliced at {children} and so flagged every layout in the
   * repo, because the main `return (` necessarily sits above it. A lint that cries wolf on correct
   * code gets its budget raised, which is how the real finding gets buried.
   */
  const mainReturnAt = src.lastIndexOf("return", childrenAt);
  const guardSection = src.slice(0, mainReturnAt);
  // A `return (` or `return <` in the guard section is a refusal that does not stop the page.
  const re = /^\s*return\s*[(<]/gm;
  let m;
  while ((m = re.exec(guardSection)) !== null) {
    const line = guardSection.slice(0, m.index).split("\n").length;
    found.push(
      `apps/${app}/app/(protected)/layout.tsx:${line}  returns a screen instead of redirecting — ` +
        `the page still renders into the RSC payload`,
    );
  }
}

for (const f of found) console.log(`  ${f}`);
console.log(`layout-guard-lint: ${found.length} leaking refusal(s) across ${checked} protected layout(s) (budget 0).`);
if (found.length > 0) {
  console.error(
    `\nlayout-guard-lint FAILED.\n` +
      `Refusing access by returning a component does NOT stop the page from rendering — Next\n` +
      `executes the page segment anyway and streams it into the RSC flight payload, so the data\n` +
      `you meant to withhold ships behind the refusal screen.\n\n` +
      `Use \`redirect("/no-access")\` or \`redirect("/locked")\` — redirect() throws, which aborts\n` +
      `the render — and put the screen on its own route outside (protected).`,
  );
  process.exit(1);
}
