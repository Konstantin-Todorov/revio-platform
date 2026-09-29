#!/usr/bin/env node
/**
 * A toast in a translated product is said in the reader's language — including the happy ones.
 *
 * RevioPMS, RevioCRS and RevioLink are in Bulgarian. Their REFUSALS went through dictionaries from
 * the start; eighteen SUCCESS toasts in RevioPMS ("… was posted to the folio", "Deposit refund of
 * €12.00 was recorded") stayed English literals, with a hard-coded "€" on a stay in any currency.
 * Found reading the code for a readiness report on 2026-09-29, not by any check.
 *
 * Rule: in those three apps' `lib/`, `setFlash("success" | "info", ` may not be followed directly by
 * a string or template literal. Say it through the app's dictionary. The Operator is English by
 * decision and is not checked.
 *
 * Run: node scripts/flash-lint.mjs   (part of `pnpm verify`)
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";

const APPS = ["pms", "reservation", "channel-manager"];
const LITERAL = /setFlash\(\s*"(success|info)"\s*,\s*[`"']/;
const hits = [];
let files = 0;
for (const app of APPS) {
  const dir = `apps/${app}/lib`;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    files++;
    readFileSync(`${dir}/${f}`, "utf8").split("\n").forEach((line, i) => {
      if (LITERAL.test(line)) hits.push(`${dir}/${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
}
if (hits.length) {
  console.error(`\nflash-lint: ${hits.length} toast(s) in a translated product written as an English literal:\n`);
  for (const h of hits) console.error(`  ${h}`);
  console.error("\nSay it through the app's dictionary (e.g. apps/pms/lib/i18n/flash.ts) so a Bulgarian reader gets Bulgarian.\n");
  process.exit(1);
}
console.log(`flash-lint: ${files} files in the translated products, every toast through a dictionary.`);
