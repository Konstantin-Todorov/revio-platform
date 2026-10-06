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
 * Where each service lives.
 *
 * An explicit variable wins — `CRS_URL` and friends, so a custom domain is one setting. Failing that
 * we use `RAILWAY_SERVICE_<NAME>_URL`, which **Railway injects into every service for every sibling**
 * with no configuration at all.
 *
 * ⚠️ The fallback is not a convenience. Without it a new job is scheduled, deployed, and silently
 * skipped for want of a variable nobody knew to set — which is precisely how `waitlist-sweep` came
 * to be declared, tested and never once run. A job that cannot find its service should be a loud
 * failure, not a quiet `skip` line nobody reads; the fallback means the case barely arises, and the
 * skip below still says so when it does.
 */
function serviceUrl(explicit, railwayVar) {
  const direct = process.env[explicit]?.trim();
  if (direct) return direct.replace(/\/+$/, "");
  const host = process.env[railwayVar]?.trim();
  if (!host) return undefined;
  return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

const CRS = serviceUrl("CRS_URL", "RAILWAY_SERVICE_RESERVATION_URL");
const CM = serviceUrl("CM_URL", "RAILWAY_SERVICE_CHANNEL_MANAGER_URL");
const PMS = serviceUrl("PMS_URL", "RAILWAY_SERVICE_PMS_URL");
const OPERATOR = serviceUrl("OPERATOR_URL", "RAILWAY_SERVICE_OPERATOR_URL");

const JOBS = [
  { name: "hold-expiry", url: CRS && `${CRS}/api/jobs/holds` },
  { name: "pickup-snapshot", url: CRS && `${CRS}/api/jobs/pickup` },
  // RevioDirect balances, charged on the date the guest agreed to — in each hotel's own day.
  { name: "balance-charges", url: CRS && `${CRS}/api/jobs/balance-charges` },
  { name: "channex-pull", url: CM && `${CM}/api/jobs/pull` },
  { name: "arrivals-digest", url: CM && `${CM}/api/jobs/arrivals` },
  // Nightly is plenty: a mapping only changes when a person changes it. What it catches does
  // not announce itself — a row pointing at another room pushes successfully forever.
  { name: "mapping-audit", url: CM && `${CM}/api/jobs/mapping-audit` },
  // Once a day (the route decides): is each OTA selling what we send? Re-sends what differs and
  // raises what still differs. After the audit, so a mapping it just flagged is already on record.
  { name: "channel-read-back", url: CM && `${CM}/api/jobs/read-back` },
  // Hourly, and it sends nothing when there is nothing — see the route. It is what makes every
  // other check on this list reach a person instead of a screen nobody has open.
  { name: "operator-alerts", url: OPERATOR && `${OPERATOR}/api/jobs/alerts` },
  { name: "auto-assign", url: PMS && `${PMS}/api/jobs/assign` },
  { name: "auto-close-day", url: PMS && `${PMS}/api/jobs/closeday` },
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
  { name: "waitlist-sweep", url: CRS && `${CRS}/api/jobs/waitlist` },
  /* After the waitlist, with the other guest-facing mail; it reads only the reservation record. */
  { name: "guest-mail", url: CRS && `${CRS}/api/jobs/guest-mail` },
  /*
   * Last, and on the operator rather than a hotel app: a trial is our commercial arrangement, and
   * the row that decides when access stops is operator-perimeter. Placed after everything else for
   * the same reason as the waitlist — nothing here depends on it, and it is the one job that can
   * remove a hotel's access, so it runs when the rest of the tick has already succeeded.
   */
  { name: "trial-sweep", url: OPERATOR && `${OPERATOR}/api/jobs/trials` },
  // Keeps the demo hotels mid-service. Harmless if it fails — nothing a customer touches depends on
  // it — but a blank demo calendar is what a hotel sees before deciding to trust us.
  // `critical: false`: its failure is printed and the health page still shows it, but it does not turn
  // the run red — a red run emails "Deployment crashed", and that email has to mean a hotel is affected.
  { name: "demo-refresh", url: OPERATOR && `${OPERATOR}/api/jobs/demo-refresh`, critical: false },
  // Drafting invoices is scheduled, not a button somebody has to remember in the right month.
  { name: "invoice-run", url: OPERATOR && `${OPERATOR}/api/jobs/invoices` },

  /*
   * Last, and on the operator like the trial sweep: the mailbox is ours, not a hotel's.
   *
   * After everything else because a reply filed here can reopen a case, and reopening one is more
   * useful once the rest of the tick has finished changing the world it refers to.
   */
  { name: "support-inbox", url: OPERATOR && `${OPERATOR}/api/jobs/support-inbox` },
];

/** Long enough for a night audit across many properties; short enough that a hung job ends the run. */
const TIMEOUT_MS = 120_000;

async function run({ name, url, critical = true }) {
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
      // 502/503/504 is the service not answering (restarting, deploying) — not the job failing.
      return { name, ok: false, critical, transient: res.status >= 502 && res.status <= 504 };
    }

    /**
     * A 200 is not the evidence. `fetch` follows redirects, so an endpoint the app's middleware
     * sends to /login answers **200 with an HTML page** — and this check read that as success for
     * every tick of `trial-sweep`'s life, printing `ok` and `8/8 succeeded` over a login form.
     *
     * Every job route returns JSON and always sets `ok`. So require it: parse the body, and treat
     * anything that is not JSON — or that says `ok: false` — as the failure it is. HTML here always
     * means we reached a page instead of a job.
     */
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      const looksLikePage = /^\s*<(!doctype|html)/i.test(body);
      console.error(
        `FAIL  ${name} — HTTP ${res.status} but the body is not JSON in ${ms}ms` +
          `${looksLikePage ? " (an HTML page — the request reached a screen, not the job; check the app's middleware matcher)" : ""}` +
          ` · ${body.slice(0, 200)}`,
      );
      return { name, ok: false, critical };
    }
    if (parsed?.ok === false) {
      console.error(`FAIL  ${name} — the job reported failure in ${ms}ms · ${body.slice(0, 300)}`);
      return { name, ok: false, critical };
    }

    console.info(`ok    ${name} — ${ms}ms · ${body.slice(0, 300)}`);
    return { name, ok: true };
  } catch (err) {
    const ms = Date.now() - started;
    const reason = err?.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : String(err);
    console.error(`FAIL  ${name} — ${reason} (${ms}ms)`);
    // No answer at all (timeout, connection refused/reset) — usually the target was mid-deploy.
    return { name, ok: false, critical, transient: true };
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

/*
 * One retry for a job that got NO ANSWER, after a pause.
 *
 * On 2026-09-30 a tick ran while the apps were being redeployed: every call took ~15s and
 * `mapping-audit` did not answer in 120s, so the runner exited 1 and Railway emailed "Deployment
 * crashed" about a job that was fine. A job that ANSWERED with a failure is not retried — that is a
 * real fault and must stay loud. Retrying is safe: every job holds a lease, and a second call while
 * the first still runs is told so rather than running twice.
 */
const RETRY_AFTER_MS = 45_000;
const transient = results.filter((r) => r.ok === false && r.transient);
if (transient.length > 0) {
  console.info(`\nrun-jobs: ${transient.length} job(s) got no answer — retrying once in ${RETRY_AFTER_MS / 1000}s: ${transient.map((t) => t.name).join(", ")}`);
  await new Promise((r) => setTimeout(r, RETRY_AFTER_MS));
  for (const t of transient) {
    const again = await run(JOBS.find((j) => j.name === t.name));
    results[results.indexOf(t)] = again;
  }
}

const failed = results.filter((r) => r.ok === false);
const ran = results.filter((r) => !r.skipped);
console.info(`\nrun-jobs: ${ran.length - failed.length}/${ran.length} succeeded.`);
const minor = failed.filter((f) => f.critical === false);
if (minor.length > 0) console.warn(`run-jobs: non-critical job(s) failed, run stays green — ${minor.map((f) => f.name).join(", ")}`);
const critical = failed.filter((f) => f.critical !== false);
if (critical.length > 0) {
  console.error(`run-jobs: failed — ${critical.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
