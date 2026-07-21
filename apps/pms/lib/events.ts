import "server-only";
import { prisma } from "./db";

/**
 * The operational event stream (PMS-REFINEMENT-R1 §6.8 / §7.4 / §8.7) — one append-only log that
 * powers the live housekeeping / maintenance boards, the self-populating per-room timeline, and the
 * manager-only performance analytics. Every status change and clock-in appends one `OpsEvent`.
 *
 * Boundary: this is EMPLOYEE data — analytics built on it are manager/owner-only, EU worker-monitoring
 * aware, never a live staff leaderboard (§6.8/§6.9). This module is the shared producer + reader; the
 * screens (J6/J8/J9) consume it.
 */

export type OpsDomain = "housekeeping" | "maintenance" | "workforce";

export interface OpsEventInput {
  propertyId: string;
  tenantId: string;
  domain: OpsDomain;
  action: string; // status_change | clock_in | clock_out | assigned | inspection_pass | inspection_fail | …
  unitId?: string | null;
  userId?: string | null; // the staff member the event is ABOUT
  actorId?: string | null; // who performed it (may differ — supervisor/delegated)
  fromState?: string | null;
  toState?: string | null;
  refId?: string | null; // owning task/shift id
  meta?: Record<string, unknown> | null;
}

/** Append one event. Never throws into the caller's write path — a lost analytics row must not fail
 * an operational action. */
export async function recordOpsEvent(input: OpsEventInput): Promise<void> {
  try {
    await prisma.opsEvent.create({
      data: {
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        domain: input.domain,
        action: input.action,
        unitId: input.unitId ?? null,
        userId: input.userId ?? null,
        actorId: input.actorId ?? null,
        fromState: input.fromState ?? null,
        toState: input.toState ?? null,
        refId: input.refId ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch {
    /* event logging is best-effort; the operational write already succeeded. */
  }
}

export type UnitTimelineRow = {
  id: string;
  domain: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actorId: string | null;
  userId: string | null;
  at: Date;
  meta: Record<string, unknown> | null;
};

/** Per-room lifecycle timeline (§7.4) — every status change / task / move for a unit, newest first. */
export async function getUnitTimeline(unitId: string, limit = 50): Promise<UnitTimelineRow[]> {
  const rows = await prisma.opsEvent.findMany({
    where: { unitId },
    orderBy: { at: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id, domain: r.domain, action: r.action, fromState: r.fromState, toState: r.toState,
    actorId: r.actorId, userId: r.userId, at: r.at,
    meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
  }));
}

// Paused/abandoned cleans skew averages (§6.8 guardrail): ignore any single clean whose measured
// duration exceeds this cap when computing averages.
const MAX_REASONABLE_CLEAN_MINUTES = 120;

export type CleanerPerf = {
  userId: string;
  cleaned: number; // rooms finished (reached Awaiting inspection or Ready)
  avgCleanMinutes: number | null; // over non-outlier cleans
  inspectionsPassed: number;
  inspectionsFailed: number;
};

/**
 * Manager-only housekeeping performance (§6.8): rooms cleaned per cleaner, average clean time, and
 * inspection pass/fail — computed from the event stream over a window. Clean time = the gap between a
 * cleaner's "In progress" event and the matching "done" (Awaiting inspection / Ready) event for the
 * same unit; outliers (paused cleans) are dropped from the average but still counted as cleaned.
 */
export async function getHousekeepingPerformance(
  propertyId: string,
  fromIso: string,
  toIso: string,
): Promise<CleanerPerf[]> {
  const events = await prisma.opsEvent.findMany({
    where: {
      propertyId,
      domain: "housekeeping",
      at: { gte: new Date(`${fromIso}T00:00:00Z`), lt: new Date(`${toIso}T23:59:59Z`) },
    },
    orderBy: { at: "asc" },
  });

  const perf = new Map<string, CleanerPerf & { _durations: number[] }>();
  const startAt = new Map<string, Date>(); // key: `${unitId}~${userId}` → last In-progress time

  const ensure = (userId: string) => {
    let p = perf.get(userId);
    if (!p) { p = { userId, cleaned: 0, avgCleanMinutes: null, inspectionsPassed: 0, inspectionsFailed: 0, _durations: [] }; perf.set(userId, p); }
    return p;
  };

  for (const e of events) {
    const who = e.userId ?? e.actorId;
    if (!who) continue;
    if (e.action === "status_change" && e.toState === "in_progress" && e.unitId) {
      startAt.set(`${e.unitId}~${who}`, e.at);
    } else if (e.action === "status_change" && (e.toState === "awaiting_inspection" || e.toState === "ready") && e.unitId) {
      const p = ensure(who);
      p.cleaned += 1;
      const started = startAt.get(`${e.unitId}~${who}`);
      if (started) {
        const mins = (e.at.getTime() - started.getTime()) / 60000;
        if (mins > 0 && mins <= MAX_REASONABLE_CLEAN_MINUTES) p._durations.push(mins);
        startAt.delete(`${e.unitId}~${who}`);
      }
    } else if (e.action === "inspection_pass") {
      ensure(who).inspectionsPassed += 1;
    } else if (e.action === "inspection_fail") {
      ensure(who).inspectionsFailed += 1;
    }
  }

  return [...perf.values()].map(({ _durations, ...p }) => ({
    ...p,
    avgCleanMinutes: _durations.length ? Math.round(_durations.reduce((a, b) => a + b, 0) / _durations.length) : null,
  }));
}
