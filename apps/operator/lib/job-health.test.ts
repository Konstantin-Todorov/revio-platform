import { describe, it, expect } from "vitest";
import { JOB } from "@revio/db";
import { jobHealth, STALE_AFTER_SECONDS } from "./job-health";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const agoSeconds = (s: number) => new Date(NOW.getTime() - s * 1000);

/** Every declared job, all healthy — the shape most assertions start from. */
function allFresh() {
  return Object.values(JOB).map((name) => ({ name, lastRunAt: agoSeconds(60) }));
}

describe("jobHealth — the hole that made this module exist", () => {
  it("reports a declared job that has never run, with no lease row at all", () => {
    // The row is created by acquireJobLease on the first run. Before that there is nothing to read,
    // and the old row-driven version simply left the job out of its answer.
    const report = jobHealth([], NOW);

    expect(report.jobs.map((j) => j.name).sort()).toEqual(Object.values(JOB).slice().sort());
    expect(report.jobs.every((j) => j.state === "never")).toBe(true);
  });

  it("names the waitlist sweep even though it has never been scheduled", () => {
    // The concrete case: the job was added to the code, and its cron entry can be forgotten.
    const report = jobHealth(allFresh().filter((l) => l.name !== JOB.waitlistSweep), NOW);

    const sweep = report.jobs.find((j) => j.name === JOB.waitlistSweep);
    expect(sweep).toEqual({
      name: JOB.waitlistSweep,
      ageSeconds: null,
      state: "never",
      declared: true,
    });
  });

  it("lists every job the code declares, whatever the database holds", () => {
    for (const name of Object.values(JOB)) {
      expect(jobHealth([], NOW).jobs.some((j) => j.name === name)).toBe(true);
    }
  });
});

describe("jobHealth — states", () => {
  it("calls a job that ran recently ok", () => {
    const report = jobHealth(allFresh(), NOW);
    expect(report.state).toBe("ok");
    expect(report.jobs.every((j) => j.state === "ok")).toBe(true);
  });

  it("calls a job stale once it passes the tolerance", () => {
    const leases = allFresh();
    leases[0]!.lastRunAt = agoSeconds(STALE_AFTER_SECONDS + 1);

    const report = jobHealth(leases, NOW);

    expect(report.jobs.find((j) => j.name === leases[0]!.name)?.state).toBe("stale");
    expect(report.state).toBe("degraded");
  });

  it("treats exactly the tolerance as still ok", () => {
    const leases = allFresh();
    leases[0]!.lastRunAt = agoSeconds(STALE_AFTER_SECONDS);

    expect(jobHealth(leases, NOW).state).toBe("ok");
  });

  it("reports the age in seconds since the last successful run", () => {
    const leases = allFresh();
    leases[0]!.lastRunAt = agoSeconds(routeAge());

    expect(jobHealth(leases, NOW).jobs.find((j) => j.name === leases[0]!.name)?.ageSeconds).toBe(routeAge());
  });
});

function routeAge() {
  return 421;
}

describe("jobHealth — what fails the check and what does not", () => {
  it("does not go degraded because a new job has not ticked yet", () => {
    // A monitor that screams on every deploy is a monitor somebody mutes.
    const report = jobHealth(allFresh().slice(1), NOW);

    expect(report.jobs.some((j) => j.state === "never")).toBe(true);
    expect(report.state).toBe("ok");
  });

  it("goes degraded for a job that ran once and then stopped", () => {
    const leases = allFresh();
    leases[1]!.lastRunAt = agoSeconds(60 * 60 * 24);

    expect(jobHealth(leases, NOW).state).toBe("degraded");
  });

  it("stays degraded while any single job is stale", () => {
    const leases = allFresh();
    leases[2]!.lastRunAt = agoSeconds(STALE_AFTER_SECONDS * 4);

    const report = jobHealth(leases, NOW);

    expect(report.jobs.filter((j) => j.state === "stale")).toHaveLength(1);
    expect(report.state).toBe("degraded");
  });
});

describe("jobHealth — orphan rows", () => {
  it("keeps showing a lease whose name the code no longer declares", () => {
    // A renamed job leaves its old row behind. Hiding it would hide the rename's other half.
    const report = jobHealth([...allFresh(), { name: "retired-job", lastRunAt: agoSeconds(60) }], NOW);

    expect(report.jobs.find((j) => j.name === "retired-job")).toMatchObject({ declared: false });
  });

  it("marks everything the code declares as declared", () => {
    const report = jobHealth(allFresh(), NOW);
    expect(report.jobs.every((j) => j.declared)).toBe(true);
  });

  it("still goes degraded on a stale orphan, because a rename that half-happened is a fault", () => {
    const report = jobHealth(
      [...allFresh(), { name: "retired-job", lastRunAt: agoSeconds(STALE_AFTER_SECONDS + 1) }],
      NOW,
    );

    expect(report.state).toBe("degraded");
  });
});

describe("jobHealth — output stability", () => {
  it("sorts by name, so two readings differ only when something changed", () => {
    const shuffled = [...allFresh()].reverse();
    const names = jobHealth(shuffled, NOW).jobs.map((j) => j.name);

    expect(names).toEqual([...names].sort());
  });

  it("echoes the tolerance it used", () => {
    expect(jobHealth([], NOW, 90).staleAfterSeconds).toBe(90);
    expect(jobHealth([], NOW).staleAfterSeconds).toBe(STALE_AFTER_SECONDS);
  });

  it("honours a caller-supplied tolerance", () => {
    const leases = allFresh();
    leases[0]!.lastRunAt = agoSeconds(120);

    expect(jobHealth(leases, NOW, 60).state).toBe("degraded");
    expect(jobHealth(leases, NOW, 600).state).toBe("ok");
  });
});
