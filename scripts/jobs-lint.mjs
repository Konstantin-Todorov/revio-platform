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
import { existsSync, readFileSync, readdirSync } from "node:fs";

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

/**
 * Third invariant: an app that serves a job route must let the cron runner reach it.
 *
 * A Next middleware matcher is a negative lookahead of the paths it does NOT gate. An app whose
 * matcher omits `api/jobs` sends the cron POST to /login, and because `fetch` follows redirects the
 * runner receives **200 with an HTML page**. Nothing is down, nothing 500s, and the job never runs.
 *
 * That is not hypothetical either. `trial-sweep` was the operator console's first scheduled job. The
 * other three apps had exempted `api/jobs` when they got theirs; the operator's matcher listed
 * `api/health` and `api/leads` and — in a comment describing this exact failure mode — not `api/jobs`.
 * It POSTed into the login page from the day it shipped, and the runner logged `ok` every time.
 *
 * Every job route gates itself on `CRON_SECRET`, so the exemption is not a hole: it is the same
 * pattern the working apps already use.
 */
const unreachable = [];
for (const app of readdirSync("apps")) {
  const routes = `apps/${app}/app/api/jobs`;
  const middleware = `apps/${app}/middleware.ts`;
  if (!existsSync(routes) || !existsSync(middleware)) continue;
  const matcher = readFileSync(middleware, "utf8").match(/matcher:\s*\[([\s\S]*?)\]/);
  if (!matcher) {
    unreachable.push(`${app} — no \`matcher\` found in middleware.ts, so the check cannot see what is gated`);
    continue;
  }
  if (!matcher[1].includes("api/jobs")) unreachable.push(`${app} — serves apps/${app}/app/api/jobs but its middleware matcher does not exempt it`);
}

const unscheduled = declared.filter((n) => !scheduled.includes(n) && !NOT_SCHEDULED.has(n));
const unknown = scheduled.filter((n) => !declared.includes(n));

if (unscheduled.length === 0 && unknown.length === 0 && unreachable.length === 0) {
  console.log(`jobs-lint: ${declared.length} declared job(s), all scheduled and reachable by the runner.`);
  process.exit(0);
}

if (unreachable.length > 0) {
  console.error("jobs-lint FAILED: a job route the cron runner cannot reach.\n");
  for (const n of unreachable) console.error(`  ${n}`);
  console.error(
    "\nThe middleware would redirect the cron POST to /login. `fetch` follows redirects, so the" +
      "\nrunner sees 200 and an HTML page and calls it a success while the job never runs. Add" +
      "\n`api/jobs` to the matcher's exclusion list — the route already requires CRON_SECRET.",
  );
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
