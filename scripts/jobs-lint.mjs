#!/usr/bin/env node
/**
 * Every job the code declares must actually be scheduled.
 *
 * `JOB` in `packages/db/src/job-lease.ts` names the scheduled jobs. `scripts/run-jobs.mjs` is the
 * only thing that calls them. Nothing connected the two, so a job could be declared, given a route,
 * leased, tested, deployed — and never run, because the one file that would have invoked it was
 * never edited.
 *
 * That is not hypothetical. `waitlist-sweep` shipped on 2026-09-03 and was still unscheduled on
 * 2026-09-05: the feature was live, the sweep was the only thing that turns a freed room into an
 * offer, and it had never executed once in production. It was caught by the dead-man's switch, which
 * reports a declared-but-never-run job — but that only fires AFTER a deploy, and only if somebody
 * reads it. This is the same check, before the merge.
 *
 * The reverse direction is checked too: a name in the runner that `JOB` does not declare is a typo
 * or a rename half-done, and it would call an endpoint whose lease nobody holds.
 */
import { readFileSync } from "node:fs";

/**
 * Jobs deliberately not on the cron, each with the reason. Empty, and it should stay that way — a
 * job that should not be scheduled probably should not be in `JOB` either, since that registry
 * exists to name the things the scheduler runs.
 */
const NOT_SCHEDULED = new Map([]);

const registrySrc = readFileSync("packages/db/src/job-lease.ts", "utf8");
const runnerSrc = readFileSync("scripts/run-jobs.mjs", "utf8");

const block = registrySrc.match(/export const JOB = \{([\s\S]*?)\n\} as const;/);
if (!block) {
  console.error("jobs-lint: could not find `export const JOB = {...} as const;` — the check is blind, which is a silent pass.");
  process.exit(1);
}

// `key: "value",` — the value is the name the lease, the health endpoint and the runner all share.
const declared = [...block[1].matchAll(/^\s*\w+:\s*"([^"]+)"/gm)].map((m) => m[1]);
if (declared.length === 0) {
  console.error("jobs-lint: parsed ZERO job names out of the JOB registry — the check is blind.");
  process.exit(1);
}

const scheduled = [...runnerSrc.matchAll(/\{\s*name:\s*"([^"]+)"/g)].map((m) => m[1]);
if (scheduled.length === 0) {
  console.error("jobs-lint: parsed ZERO job names out of run-jobs.mjs — the check is blind.");
  process.exit(1);
}

const unscheduled = declared.filter((n) => !scheduled.includes(n) && !NOT_SCHEDULED.has(n));
const unknown = scheduled.filter((n) => !declared.includes(n));

if (unscheduled.length === 0 && unknown.length === 0) {
  console.log(`jobs-lint: ${declared.length} declared job(s), all scheduled.`);
  process.exit(0);
}

if (unscheduled.length > 0) {
  console.error("jobs-lint FAILED: declared in `JOB` but never called by the cron runner.\n");
  for (const n of unscheduled) console.error(`  ${n}`);
  console.error(
    "\nA job nothing calls is inert however well it is written and tested. Add it to the `JOBS`" +
      "\nlist in scripts/run-jobs.mjs in the same commit that declares it — or, if it genuinely should" +
      "\nnot be scheduled, to NOT_SCHEDULED in this file WITH A REASON.",
  );
}

if (unknown.length > 0) {
  console.error("\njobs-lint FAILED: called by the cron runner but not declared in `JOB`.\n");
  for (const n of unknown) console.error(`  ${n}`);
  console.error(
    "\nUsually a typo or a half-finished rename. The runner would call an endpoint whose lease" +
      "\nname nobody holds, so two replicas could run it at once.",
  );
}

process.exit(1);
