import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import type { JobHealthReport } from "@/lib/job-health";

/**
 * Whether the scheduled jobs actually ran, on the screen a person opens.
 *
 * ## Why this exists
 *
 * The dead-man's switch was already correct and already polled — it just answered in JSON, to a
 * GitHub workflow, outside the console. Platform Health said only that a workflow "also verifies the
 * scheduled jobs are still running", which is a promise about a check rather than its result.
 *
 * It has cost twice. `waitlist-sweep` sat at `never` for two days: declared, deployed and invoked by
 * nothing. Then `trial-sweep` spent its entire life POSTing into a login page, and the endpoint said
 * `never` about it every minute, in a body nobody reads. Both were visible the whole time to
 * anybody who ran `curl`.
 *
 * ## `never` is loud here even though it does not fail the check
 *
 * `jobHealth` deliberately does not let `never` degrade the overall state: a job that has never run
 * is a signal that something was not finished, and paging somebody at 3am for an unfinished
 * deployment trains them to ignore the pager. That reasoning is about **alerting**. It is not a
 * reason to make it hard to see — so on this screen it gets the same weight as `stale` and says
 * what it means in words.
 */

/**
 * Rough, and rough on purpose: nobody needs "1,847 seconds" to decide whether a job is running.
 *
 * Clamped at zero because the age is `appNow - lastRunAt` across two machines. Any clock skew makes
 * that negative, and "ran -10714s ago" on a health screen is worse than useless — it is the screen
 * itself looking broken at the moment somebody came to it to find out what is broken.
 */
function ago(seconds: number): string {
  if (seconds <= 0) return "just now";
  if (seconds < 90) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function JobHealthCard({ report }: { report: JobHealthReport }) {
  const never = report.jobs.filter((j) => j.state === "never").length;
  const stale = report.jobs.filter((j) => j.state === "stale").length;
  const orphans = report.jobs.filter((j) => !j.declared).length;

  const summary =
    stale > 0
      ? `${stale} not running`
      : never > 0
        ? `${never} never run`
        : `all ${report.jobs.length} running`;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Scheduled jobs"
        subtitle={`Late after ${Math.round(report.staleAfterSeconds / 60)} minutes without a successful run`}
        action={
          <StatusPill tone={stale > 0 ? "danger" : never > 0 ? "warning" : "success"}>{summary}</StatusPill>
        }
      />
      <ul className="divide-y divide-surface-border">
        {report.jobs.map((j) => (
          <li key={j.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="font-mono text-[12.5px] font-semibold text-ink-900">{j.name}</span>

            {j.state === "ok" && <StatusPill tone="success">ran {ago(j.ageSeconds!)}</StatusPill>}
            {j.state === "stale" && <StatusPill tone="danger">last ran {ago(j.ageSeconds!)}</StatusPill>}
            {j.state === "never" && <StatusPill tone="warning">never run</StatusPill>}

            {/* A name the code no longer declares — almost always a rename left half-done. */}
            {!j.declared && <StatusPill tone="neutral">not declared any more</StatusPill>}

            <span className="ml-auto text-[11.5px] text-ink-400">
              {j.state === "never"
                ? "declared and scheduled, but has not succeeded once"
                : j.state === "stale"
                  ? "overdue — check the jobs service log"
                  : "healthy"}
            </span>
          </li>
        ))}
      </ul>
      {(never > 0 || orphans > 0) && (
        <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-500">
          {never > 0 && (
            <>
              A job that has <strong>never run</strong> does not fail the automated check, on purpose —
              it means something was left unfinished rather than something breaking. It is still worth
              a look: <code>railway logs --service jobs</code> says what the runner got back.
            </>
          )}
          {never > 0 && orphans > 0 && " "}
          {orphans > 0 && <>A job that is no longer declared is usually a rename that stopped halfway.</>}
        </p>
      )}
    </Card>
  );
}
