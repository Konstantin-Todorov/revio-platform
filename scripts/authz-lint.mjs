#!/usr/bin/env node
/**
 * Every server action in RevioLink and RevioCRS is gated, or is on this file's exemption list (X2).
 *
 * ## Why a script and not a code review
 *
 * X2 was that 108 of 110 server actions in these two apps had no role check at all. Fixing them once
 * is easy; the hard part is that action number 111 gets written next month by someone who has never
 * read this file, and nothing would notice. A capability model nobody enforces decays into the same
 * decoration the role field already was.
 *
 * So: this walks every `actions-*.ts`, finds every exported action, and asserts each one either
 * calls `requireCapability(...)`/`guard(...)` near the top, or appears in EXEMPT below **with a
 * written reason**. A new action is a failure until somebody decides which it is.
 *
 * Run: `node scripts/authz-lint.mjs` (part of `pnpm verify` and CI).
 *
 * ⚠️ It checks that a guard is CALLED, not that the right capability was chosen. Picking
 * `manageInventory` where `manageRates` was meant is a judgement this cannot make — that is what the
 * `@revio/core` capability tests and review are for. What it does guarantee is that the judgement
 * was made at all.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname — this repo lives under a directory with a space in its name, and
// .pathname percent-encodes it. That exact bug once made copy-lint report "clean" having scanned
// zero files, so it is not repeated here.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// RevioPMS is in this list for the reason it should never have been out of it: it is the app where
// the ungated-write hole was actually found (X2 — a housekeeper could post a payment or check a guest
// out with a crafted POST, because the layout re-guards only after the action has already committed).
// That was fixed and pinned by lib/roles.test.ts, but the tests pin the POLICY, not the COVERAGE —
// nothing stopped the next new action from shipping ungated. Now something does.
//
// The Operator console was the last one missing, and it is the one that matters most: it reads every
// hotel's data and holds their OTA credentials, so an ungated action there is not a leak into one
// tenant but into all of them. It was noticed only because adding a 2FA action did not move the
// count.
const APPS = ["apps/channel-manager", "apps/reservation", "apps/pms", "apps/operator"];

/**
 * Actions that deliberately have no capability gate, and why.
 *
 * Every entry is a decision, not an oversight. Keep the reasons — an exemption without one is
 * indistinguishable from something that was forgotten.
 */
const EXEMPT = {
  // Authentication itself. Gating these on a capability would require a session to sign in.
  "actions-auth.ts:login": "signing in — there is no session to check yet",
  "actions-auth.ts:logout": "ending your own session is always allowed",
  "actions-auth.ts:signOutEverywhere": "revoking your OWN sessions; a locked-out user must be able to do this",
  "actions-auth.ts:verifyTwoFactor": "step two of signing in — gated by the pending-2FA token, which is issued only by a correct password",

  // Self-service account recovery, reachable while signed out.
  "actions-account.ts:requestReset": "password reset, requested while signed out",
  "actions-account.ts:setPassword": "setting your own password from a one-time token",

  // Changing what YOU are looking at. Writes a cookie, not hotel data.
  "actions-session.ts:setActiveProperty": "switches which property you are viewing — a cookie, not a write",
  "actions-session.ts:setGroupScope": "switches to portfolio view — a cookie, not a write",

  // Gated on a ROLE SET rather than a capability. Real checks, spelled differently — the guard is
  // `MANAGER_ROLES.has(session.role)` / `DELEGATOR_ROLES.has(...)` on the first line, and the action
  // returns without writing when it fails. Listed rather than pattern-matched because a regex loose
  // enough to catch `X_ROLES.has(...)` would also catch any incidental `.has()` and quietly stop
  // being a check at all.
  "actions-guests.ts:mergeGuests": "manager-only via MANAGER_ROLES.has(s.role) — merging identities is irreversible",
  "actions-workforce.ts:clockInUser": "delegated clock-in, gated on DELEGATOR_ROLES (manager, supervisor, reception)",
  "actions-workforce.ts:clockOutUser": "delegated clock-out, gated on DELEGATOR_ROLES",

  // Protecting YOUR OWN account. Same shape as clocking yourself in, below: the action reads
  // `session.userId` and never accepts an id from the form, so it can only ever touch the caller's
  // own second factor. A capability here would be backwards — it would mean a receptionist needs
  // permission to secure their own login, and the people most worth protecting are the ones with the
  // fewest permissions to spend on it. Turning it OFF is the sensitive direction and is gated on the
  // current password rather than a role: an unattended laptop must not be enough to remove the
  // protection that exists for the case where somebody else has your laptop.
  "actions-2fa.ts:startTwoFactor": "begins enrolment for your OWN account; acts only on session.userId",
  "actions-2fa.ts:confirmTwoFactor": "completes enrolment for your OWN account; acts only on session.userId",
  "actions-2fa.ts:turnOffTwoFactor": "disables 2FA on your OWN account, gated on re-entering your current password",

  // Clocking YOURSELF in and out. A session is the whole authorisation: the action reads the caller's
  // own userId and can only ever touch that person's shift. A capability here would mean a cleaner
  // needs permission to record that they started cleaning.
  "actions-workforce.ts:clockInSelf": "records your OWN shift start; acts only on session.userId",
  "actions-workforce.ts:clockOutSelf": "records your OWN shift end; acts only on session.userId",
};

// `ctx("capability")` is RevioPMS's spelling of the same thing, not a weaker one: it resolves the
// session, checks `roleHasCapability`, and redirects the caller to their own home screen when the
// answer is no — so nothing after it runs. Recognising it is what lets the PMS be scanned at all;
// leaving it out would report all 40-odd of its correctly-gated actions and teach everyone to ignore
// the check, which is worse than not running it.
// `getOperatorSession` is the Operator console's boundary, and a coarser one on purpose. That app is
// entirely staff-only behind one perimeter with two roles, so "is a signed-in operator" IS the
// authorisation for most of it, and only staff management narrows further to super_admin. Every one
// of its data-touching actions calls this and acts on the result — checked one by one when the app
// was added to this scan, not assumed.
//
// ⚠️ Weaker than the others: this matches the CALL, and cannot see whether the result was checked.
// The same limitation the header already states about capability CHOICE applies here to capability
// USE. If the console ever grows real capabilities, tighten this to a `requireOperator()` helper
// that redirects internally, the way RevioPMS's `ctx()` does.
const GUARD = /\b(requireCapability|guard|requireManager|getOperatorSession)\s*\(|\bctx\s*\(\s*["']/;
/** How far into a function body a guard may appear. It should be the first statement; this is slack. */
const HEAD_LINES = 14;

let checked = 0;
const ungated = [];
const staleExemptions = new Set(Object.keys(EXEMPT));

for (const app of APPS) {
  const dir = join(ROOT, app, "lib");
  const files = readdirSync(dir).filter((f) => /^actions-.*\.ts$/.test(f));
  if (files.length === 0) {
    console.error(`authz-lint: no action files found in ${app}/lib — the scan is broken, not the code.`);
    process.exit(2);
  }

  for (const file of files) {
    const src = readFileSync(join(dir, file), "utf8");
    const lines = src.split("\n");

    lines.forEach((line, i) => {
      const m = /^export async function ([A-Za-z0-9_]+)\s*\(/.exec(line);
      if (!m) return;
      const name = m[1];
      checked += 1;

      const key = `${file}:${name}`;
      if (EXEMPT[key]) {
        staleExemptions.delete(key);
        return;
      }

      const head = lines.slice(i, i + HEAD_LINES).join("\n");
      if (!GUARD.test(head)) ungated.push(`${app}/lib/${file}  →  ${name}`);
    });
  }
}

if (checked === 0) {
  console.error("authz-lint: 0 actions were checked — the scan is broken, not the code.");
  process.exit(2);
}

// An exemption for something that no longer exists is a rule protecting nothing, and it hides the
// fact that the list has stopped describing the codebase.
if (staleExemptions.size > 0) {
  console.error("authz-lint: EXEMPT lists actions that no longer exist:");
  for (const k of staleExemptions) console.error(`  ${k} — remove it from scripts/authz-lint.mjs`);
  process.exit(1);
}

if (ungated.length > 0) {
  console.error(`\nauthz-lint: ${ungated.length} server action(s) have no capability gate:\n`);
  for (const u of ungated) console.error(`  ${u}`);
  console.error(
    "\nA server action is a POST endpoint. Next runs it BEFORE re-rendering, so a layout redirect\n" +
      "fires after the write has already committed — hiding the button protects nobody.\n\n" +
      "Add `await requireCapability(\"...\")` (void actions) or `const g = await guard(\"...\")`\n" +
      "(actions returning a result) as the first statement — or, if it genuinely needs no gate, add it\n" +
      "to EXEMPT in scripts/authz-lint.mjs WITH A REASON.\n",
  );
  process.exit(1);
}

console.log(
  `authz-lint: ${checked} server actions · ${checked - Object.keys(EXEMPT).length} gated · ` +
    `${Object.keys(EXEMPT).length} exempt with a stated reason.`,
);
