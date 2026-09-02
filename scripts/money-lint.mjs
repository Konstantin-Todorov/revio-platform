/**
 * The unreadable-number ratchet.
 *
 * ⚠️ **`Math.max(0, NaN)` is `NaN`, not 0.** That one fact is why this file exists.
 *
 * A server action that hand-rolls `Math.round(Number(str(fd, "price")) * 100)` looks careful and is
 * not. Every operation after a `NaN` stays `NaN`, `Math.max` does not clamp it, and the value
 * reaches Prisma — which rejects the write with an exception the user sees as a crash, or worse,
 * accepts it into a column somebody later does arithmetic on. It was found in production on
 * 2026-09-02 writing `priceMinor: NaN` from the RevioLink calendar, and three more live sites were
 * still doing it in RevioCRS a day later: two on a confirmed reservation's price, one on a tax that
 * reaches the guest's all-in price.
 *
 * It is not a hard problem — it is a problem that looks solved. `Number("")` is `0`, so the usual
 * `|| "0"` guard passes a blank field and lets letters and comma decimals ("12,50", which is what a
 * European guest types) straight through.
 *
 * **The fix is never to write the parsing.** `@revio/core/forms/parse` already does it, is tested,
 * and converts money as a STRING so a cent cannot drift:
 *
 *     import { money, decimal, int } from "./mutation-helpers";
 *     const priceMinor = money(fd, "price", 0);      // never NaN
 *
 * And where an unreadable value must be refused rather than defaulted — which is the right answer
 * for money — read it first and say so:
 *
 *     const raw = str(fd, "price");
 *     if (raw !== "" && !Number.isFinite(Number(raw))) return flashError("That price isn’t a number we can read.");
 *
 * A price nobody can read is **not zero**. Zero is a real price meaning "free", and writing it
 * silently is worse than refusing.
 *
 * This lint therefore allows a line that carries an explicit `Number.isFinite` check, and flags a
 * raw coercion of form input that carries none.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];

/** Ratchet. Lower this when you fix some; never raise it. */
const BUDGET = 0;

/** Coercions that produce NaN silently. `intOr`/`decimalOr`/`minorUnitsOr` are the sanctioned way. */
const COERCION = /\b(Number|parseFloat|parseInt)\s*\(/;
/** Only care when the value came from a form — date arithmetic on numbers is not this bug. */
const FROM_FORM = /\bfd\b|formData|\.get\(|input\.value/;

const found = [];
let scanned = 0;

for (const app of APPS) {
  const dir = `apps/${app}/lib`;
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => /^actions-.*\.ts$/.test(f))) {
    const path = `${dir}/${file}`;
    scanned++;
    const lines = readFileSync(path, "utf8").split("\n");
    lines.forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;
      if (!COERCION.test(code) || !FROM_FORM.test(code)) return;

      // `Number(x) || 0` IS safe: NaN is falsy, so the fallback fires. `?? 0` is NOT — NaN is not
      // nullish and sails straight through — so only `||` counts.
      if (/\|\|\s*-?\d/.test(code)) return;

      /*
       * The documented form reads the value and refuses it separately, sometimes twenty lines later
       * (a bulk update validates once before looping). A fixed look-ahead window either misses those
       * or, made big enough to catch them, silences a real bug because some OTHER variable nearby
       * happens to be checked.
       *
       * So follow the NAME. `const x = Number(...)` is safe exactly when something later asks
       * `Number.isFinite(x)`. That is precise in both directions, and it is why this lint can run at
       * a budget of zero instead of being another number nobody trusts.
       */
      const assigned = code.match(/(?:const|let|var)\s+(\w+)\s*[:=]/);
      const rest = lines.slice(i).join("\n");
      if (assigned) {
        const name = assigned[1];
        const guarded = new RegExp(`Number\\.(isFinite|isNaN)\\(\\s*${name}\\b`);
        if (guarded.test(rest)) return;
      } else if (/Number\.isFinite|Number\.isNaN/.test(lines.slice(i, i + 4).join("\n"))) {
        // An inline coercion with no name to follow — fall back to a short window.
        return;
      }

      found.push(`${path}:${i + 1}  ${code.slice(0, 110)}`);
    });
  }
}

if (scanned === 0) {
  console.error("money-lint: scanned ZERO files — the glob is wrong, which is a silent pass.");
  process.exit(1);
}

for (const f of found) console.log(`  ${f}`);
console.log(
  `money-lint: ${found.length} unguarded numeric coercion(s) of form input in ${scanned} action files (budget ${BUDGET}).`,
);
if (found.length > BUDGET) {
  console.error(
    `\nmoney-lint FAILED: ${found.length} > budget ${BUDGET}.\n` +
      `Use money()/decimal()/int() from mutation-helpers, or add an explicit Number.isFinite check.\n` +
      `Remember: Math.max(0, NaN) is NaN.`,
  );
  process.exit(1);
}
