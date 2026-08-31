/**
 * The silent-failure ratchet.
 *
 * A server action that returns `Promise<void>` cannot tell the caller anything. When one bails out
 * early — the row is gone, the role is wrong, the last owner cannot be demoted — the user presses a
 * button and the screen comes back looking exactly as it did. That is worse than an error message:
 * the user's own conclusion is that the software is broken, and their next move is to press it again.
 *
 * This counted 134 such returns across 82 actions when it was written. There is no honest way to fix
 * all of them in one pass — each needs a sentence somebody thought about — so this is a BUDGET
 * rather than a gate. The number may fall. It may not rise.
 *
 * Fixing one is a single line, because `flashError` needs nothing at the call site:
 *
 *     import { flashError } from "@revio/ui/flash";
 *     if (!row) return flashError("That room no longer exists — somebody removed it while this page was open.");
 *
 * Say what happened and what to do about it, in the user's words. "Conflict" is not a message.
 *
 * NOT every silent return is a bug. A guard against a crafted POST has no user to talk to, and a
 * no-op that is genuinely a no-op ("mark clean" on an already-clean room) should stay quiet. Where
 * that is the case, say so in a comment on the line above and leave it counted — the budget is a
 * pressure, not a verdict on each line.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

/** Ratchet. Lower this when you fix some; never raise it. */
const BUDGET = 105;

const found = [];

for (const app of APPS) {
  const dir = `apps/${app}/lib`;
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => /^actions-.*\.ts$/.test(f))) {
    const lines = readFileSync(`${dir}/${file}`, "utf8").split("\n");
    lines.forEach((line, i) => {
      const m = line.match(/^export async function (\w+)/);
      // Only actions that cannot return a value — one that returns a result can already explain
      // itself, and whether it does is a different question from this one.
      if (!m || !/Promise<void>/.test(line)) return;

      let end = i + 1;
      for (; end < lines.length; end++) if (lines[end] === "}") break;
      const body = lines.slice(i, end);

      body.forEach((b, j) => {
        if (!/^\s*(if\s*\(.*\)\s*)?return;\s*$/.test(b)) return;
        // A return in the last couple of lines is the end of the function, not a bail-out.
        if (j > body.length - 3) return;
        found.push(`apps/${app}/lib/${file}:${i + j + 1}  ${m[1]}`);
      });
    });
  }
}

if (found.length > BUDGET) {
  console.error(`\nsilent-lint: ${found.length} silent early-return(s), over the budget of ${BUDGET}.\n`);
  for (const f of found.slice(0, 20)) console.error(`  ${f}`);
  if (found.length > 20) console.error(`  … and ${found.length - 20} more`);
  console.error(
    "\nA void server action that returns early tells the user nothing — the form comes back\n" +
      "looking untouched, and they press the button again.\n\n" +
      'Use `return flashError("…")` from @revio/ui/flash, saying what happened and what to do.\n' +
      "If the return is genuinely not user-facing (a guard against a crafted POST, a real no-op),\n" +
      "say so in a comment above it — then raise nothing and fix a different one instead.\n",
  );
  process.exit(1);
}

const slack = BUDGET - found.length;
console.log(
  `silent-lint: ${found.length} silent early-return(s) in void actions (budget ${BUDGET})` +
    (slack > 0 ? ` — ${slack} under; lower the budget in scripts/silent-lint.mjs.` : "."),
);
