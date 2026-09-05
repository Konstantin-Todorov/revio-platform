#!/usr/bin/env node
/**
 * Calls every scheduled job endpoint, once, then exits.
 *
 * The jobs themselves are HTTP routes on the app services, Bearer-gated with `CRON_SECRET`, each
 * holding a lease so only one replica does the work. What was missing was anything to *call* them:
 * the routes shipped and nothing invoked them, so the automatic Close Day and auto-assignment were
 * written, tested, deployed — and inert. This is the caller, run by Railway cron.
 *
 * ⚠️ **A route added to an app is not scheduled until it is added HERE.** That happened again with
 * the waitlist sweep: shipped, deployed, and never once run, because nothing called it. The
 * dead-man's switch at `operator /api/health/jobs` now reports a declared-but-never-run job as
 * `never` precisely so this list and `JOB` in @revio/db cannot silently disagree again — it is what
 * caught this. If you add a job, add it here in the same commit.
 *
 * Deliberately dependency-free and deliberately dumb. A scheduler that needs a build, a lockfile or
 * a framework is a scheduler that can fail for reasons unrelated to the jobs it runs.
 *
 * **One job's failure does not stop the others.** They are independent — hold expiry has nothing to
 * do with the night audit — and a scheduler that abandons the rest of its list because the first
 * endpoint 500s turns one broken job into six.
 *
 * Exits non-zero if any job failed, so a red run in Railway means something genuinely needs looking
 * at rather than being a colour nobody reads.
 */

const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("run-jobs: CRON_SECRET is not set — refusing to run. The endpoints would all 401.");
  process.exit(2);
}

/**
 * Each job's URL comes from an env var so this file holds no hostnames. Railway reference variables
 * point them at the sibling services; nothing here needs to know the domains, and a renamed service
 * is a variable change rather than a code change.
 */
const JOBS = [
  { name: "hold-expiry", url: process.env.CRS_URL && `${process.env.CRS_URL}/api/jobs/holds` },
  { name: "pickup-snapshot", url: process.env.CRS_URL && `${process.env.CRS_URL}/api/jobs/pickup` },
  { name: "channex-pull", url: process.env.CM_URL && `${process.env.CM_URL}/api/jobs/pull` },
  { name: "arrivals-digest", url: process.env.CM_URL && `${process.env.CM_URL}/api/jobs/arrivals` },
  { name: "auto-assign", url: process.env.PMS_URL && `${process.env.PMS_URL}/api/jobs/assign` },
  { name: "auto-close-day", url: process.env.PMS_URL && `${process.env.PMS_URL}/api/jobs/closeday` },
  /*
   * LAST, deliberately.
   *
   * Every other job in this list can free inventory: hold expiry releases holds, the Channex pull
   * brings in cancellations, and the night audit marks no-shows. The waitlist sweep exists to notice
   * exactly that — "one sweep instead of six hooks", asking the availability engine what is
   * genuinely sellable rather than hooking each route that might have freed something.
   *
   * Running it last means it sees everything this tick produced. Anywhere earlier and it answers
   * with the world as it was ten minutes ago, and a guest waits a full cycle longer for a room that
   * was already free.
   */
  { name: "waitlist-sweep", url: process.env.CRS_URL && `${process.env.CRS_URL}/api/jobs/waitlist` },
];

/** Long enough for a night audit across many properties; short enough that a hung job ends the run. */
const TIMEOUT_MS = 120_000;

async function run({ name, url }) {
  if (!url) {
    console.warn(`skip  ${name} — its service URL is not configured`);
    return { name, skipped: true };
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
      signal: controller.signal,
    });
    const body = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      console.error(`FAIL  ${name} — HTTP ${res.status} in ${ms}ms · ${body.slice(0, 300)}`);
      return { name, ok: false };
    }
    console.info(`ok    ${name} — ${ms}ms · ${body.slice(0, 300)}`);
    return { name, ok: true };
  } catch (err) {
    const ms = Date.now() - started;
    const reason = err?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : String(err);
    console.error(`FAIL  ${name} — ${reason} (${ms}ms)`);
    return { name, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sequential, not parallel. These jobs write to one shared database and several take row locks;
 * firing them all at once to save a few seconds buys nothing and makes lock contention a scheduling
 * problem. Ordered so inventory is tidied before anything reads it: expire stale holds, pull new
 * bookings, place rooms, close the day — and only then offer what all of that freed.
 */
const results = [];
for (const job of JOBS) results.push(await run(job));

const failed = results.filter((r) => r.ok === false);
const ran = results.filter((r) => !r.skipped);
console.info(`\nrun-jobs: ${ran.length - failed.length}/${ran.length} succeeded.`);
if (failed.length > 0) {
  console.error(`run-jobs: failed — ${failed.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
