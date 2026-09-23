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
const mute = [];
const handLeased = [];
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

  /*
   * Every job route must be able to SAY that it failed.
   *
   * Without a catch, an exception leaves Next to answer a bare 500 with an empty body. The runner
   * then logs `HTTP 500 in 10166ms · ` and nothing after the separator — which is exactly what it
   * logged on 2026-09-22, and why identifying that morning's failure needed a query against the
   * error table rather than a glance at the run.
   *
   * Six of the eleven routes were still like that a day after the other five were fixed, which is
   * the argument for checking it here instead of trusting the next person to copy the pattern.
   */
  for (const job of readdirSync(routes, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const file = `${routes}/${job.name}/route.ts`;
    if (!existsSync(file)) continue;
    const src = readFileSync(file, "utf8");
    /*
     * ⚠️ A catch that ANSWERS 500 — not merely the word "catch".
     *
     * The first version of this check matched `} catch (` anywhere, and `mapping-audit` passed it on
     * the strength of an inner per-channel `catch (e)` while having no outer catch at all: an
     * exception there still produced a bare 500 with an empty body. Found 2026-09-23. Requiring the
     * 500 inside the catch is what makes it the right catch.
     */
    if (!/catch\s*\(\w+\)\s*\{[\s\S]{0,400}?status:\s*500/.test(src)) {
      mute.push(`${app}/${job.name} — apps/${app}/app/api/jobs/${job.name}/route.ts has no catch that answers 500`);
    }
    /*
     * ⚠️ ONE lease policy: `withJobLease`, which releases on both paths and stamps `lastRunAt` only
     * on success.
     *
     * Until 2026-09-23 there were three: five routes kept the lease on a failure (sometimes
     * suppressing the next tick, which then answered `ok: true`), six released in a `finally` that
     * stamped `lastRunAt` even when the run threw — so a job failing on every tick read "ok" at the
     * dead-man's switch for ever — and two used `withJobLease`. A route that takes the lease by hand
     * is how the next variant would start.
     */
    if (!src.includes("withJobLease(") || /\b(acquireJobLease|releaseJobLease)\s*\(/.test(src)) {
      handLeased.push(`${app}/${job.name} — apps/${app}/app/api/jobs/${job.name}/route.ts does not go through withJobLease`);
    }
  }
}

const unscheduled = declared.filter((n) => !scheduled.includes(n) && !NOT_SCHEDULED.has(n));
const unknown = scheduled.filter((n) => !declared.includes(n));

if (unscheduled.length === 0 && unknown.length === 0 && unreachable.length === 0 && mute.length === 0 && handLeased.length === 0) {
  console.log(`jobs-lint: ${declared.length} declared job(s), all scheduled, reachable by the runner, able to report a failure, and on one lease policy.`);
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

if (mute.length > 0) {
  console.error("\njobs-lint FAILED: a job route that cannot report its own failure.\n");
  for (const n of mute) console.error(`  ${n}`);
  console.error(
    "\nAn uncaught throw becomes a 500 with an EMPTY body, so the run log says the job failed and" +
      "\nnothing about why. Catch it and answer `{ ok: false, error }` with status 500 — the work" +
      "\nstill failed, but now it can be read. Keep the return INSIDE the try; moving it out puts" +
      "\nthe variables it reads out of scope, which is how the first attempt at this broke.",
  );
}

if (handLeased.length > 0) {
  console.error("\njobs-lint FAILED: a job route that manages its lease by hand.\n");
  for (const n of handLeased) console.error(`  ${n}`);
  console.error(
    "\nWrap the work in `withJobLease(JOB.x, ttl, async () => …)`. It releases the lease on success" +
      "\nAND on failure, so the next tick retries, and stamps `lastRunAt` only when the run succeeded," +
      "\nwhich is what the dead-man's switch at /api/health/jobs reads. A value the job wants to report" +
      "\nas a failure must be THROWN inside the callback, not returned, or it is recorded as a success.",
  );
}

process.exit(1);
