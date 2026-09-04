import { JOB } from "@revio/db";

/**
 * What the scheduled jobs are doing — derived from what the code DECLARES, not from what has
 * happened to run.
 *
 * ## The hole this closes
 *
 * The dead-man's switch used to read `JobLease` rows and map over them. A lease row is created by
 * `acquireJobLease` on a job's **first run**, so a job that has been declared in `JOB` and never
 * once scheduled has no row — and a list built from rows cannot contain it. The endpoint answered
 * `200 ok` with the job simply absent.
 *
 * That is the exact failure the switch exists for. Adding a job to the code and forgetting its cron
 * entry is the most likely way a job never runs, and it was the one case the monitor could not see.
 * Its own docstring claimed absence was "reported as `never`, visible in the body" — true only for a
 * row that exists with a null `lastRunAt`, which is a different and rarer situation.
 *
 * So the list starts from `JOB` and the leases are joined onto it. A declared job with no row is
 * `never`; a row for a name no longer declared still appears, because a renamed job leaving an
 * orphan behind is worth seeing rather than hiding.
 *
 * ## Why `never` does not fail the check
 *
 * Kept from the original, and the reasoning is still right: right after a new job ships there is a
 * window before its first tick, and a monitor that screams on every deploy is a monitor somebody
 * mutes. `never` is visible in the body without setting off the alarm. A job that ran once and then
 * stopped is the signal that something broke; a job that has never run is a signal that something
 * was not finished, and those deserve different volumes.
 */

/** The cron runs about every 5 minutes. Six missed cycles is a real fault, not a busy scheduler. */
export const STALE_AFTER_SECONDS = 30 * 60;

export interface JobLeaseRow {
  name: string;
  lastRunAt: Date | null;
}

export interface JobHealthRow {
  name: string;
  /** Seconds since the last SUCCESSFUL run; `null` when there has never been one. */
  ageSeconds: number | null;
  state: "ok" | "stale" | "never";
  /** False for a lease row whose name the code no longer declares — usually a rename left behind. */
  declared: boolean;
}

export interface JobHealthReport {
  state: "ok" | "degraded";
  staleAfterSeconds: number;
  jobs: JobHealthRow[];
}

export function jobHealth(
  leases: readonly JobLeaseRow[],
  now: Date,
  staleAfterSeconds: number = STALE_AFTER_SECONDS,
): JobHealthReport {
  const declared = new Set<string>(Object.values(JOB));
  const byName = new Map(leases.map((l) => [l.name, l] as const));

  // Every declared job, plus any orphan row. Sorted so the monitor's output is stable between polls
  // and a diff between two readings means something changed rather than that the rows came back in
  // another order.
  const names = [...new Set([...declared, ...byName.keys()])].sort();

  const jobs: JobHealthRow[] = names.map((name) => {
    const lastRunAt = byName.get(name)?.lastRunAt ?? null;
    const ageSeconds = lastRunAt ? Math.round((now.getTime() - lastRunAt.getTime()) / 1000) : null;
    const state: JobHealthRow["state"] =
      ageSeconds === null ? "never" : ageSeconds > staleAfterSeconds ? "stale" : "ok";
    return { name, ageSeconds, state, declared: declared.has(name) };
  });

  return {
    state: jobs.some((j) => j.state === "stale") ? "degraded" : "ok",
    staleAfterSeconds,
    jobs,
  };
}
