/**
 * The state-integrity checks, as one definition both the console and the CLI read.
 *
 * ## The principle
 *
 * **No record may exist in a state with no available action.** That is a rule about the whole
 * database rather than about one screen, and it was learned expensively: a hotelier found a folio
 * that said closed and open, settled and owing, at once.
 *
 * ## Why these moved out of a .sql file
 *
 * They lived only in `packages/db/scripts/state-audit.sql`, runnable by hand and by nobody else. It
 * found two real bugs in an afternoon — a cancelled booking that had held a room since July, and a
 * missing in-house guard in RevioLink — and then only because somebody thought to run it. Putting a
 * second copy in TypeScript for the operator console would have been two definitions of one concept,
 * which is how the second copy quietly loses a check. So this is the definition, and the CLI runs it
 * too.
 *
 * ## Running them
 *
 * ⚠️ These are RAW queries and must run inside `withSystemTransaction`. `forSystem()` extends only
 * MODEL operations, so `$queryRaw` on that proxy never gets the bypass GUC set — and under RLS an
 * unscoped read does not fail, it **returns zero rows**. An audit that silently reports a clean
 * database is worse than no audit at all.
 *
 * `$queryRawUnsafe` is used deliberately: every statement below is a fixed string with no
 * interpolation of any kind, and there is no caller-supplied value anywhere in this file.
 */

export interface StateCheck {
  /** Stable id — safe to reference from a dashboard or an alert. */
  id: string;
  /** Names the FAULT, not the metric: what is wrong, in a hotelier's words. */
  fault: string;
  /** What a human does about it. Shown only when the count is non-zero. */
  remedy: string;
  sql: string;
}

const LIVE_ASSIGNMENT = `EXISTS (SELECT 1 FROM "RoomAssignment" a
  WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL)`;

export const STATE_CHECKS: readonly StateCheck[] = [
  {
    id: "departed_holding_room",
    fault: "departed stay still holding a live room",
    remedy: "repair-stuck-stays.sql",
    sql: `SELECT count(*)::int AS rows FROM "Reservation" r
          WHERE r."departedAt" IS NOT NULL AND ${LIVE_ASSIGNMENT}`,
  },
  {
    id: "closed_folios_room_held",
    fault: "stay with all folios closed but rooms never released",
    remedy: "repair-stuck-stays.sql",
    sql: `SELECT count(*)::int AS rows FROM "Reservation" r
          WHERE r."departedAt" IS NULL AND ${LIVE_ASSIGNMENT}
            AND EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id)
            AND NOT EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id AND f.status = 'open')`,
  },
  {
    id: "cancelled_holding_room",
    fault: "cancelled reservation still occupying a room",
    remedy: "check the guest out in RevioPMS, or release the assignment",
    sql: `SELECT count(*)::int AS rows FROM "Reservation" r
          WHERE r.status = 'cancelled' AND ${LIVE_ASSIGNMENT}`,
  },
  {
    id: "cancelled_empty_folio_open",
    fault: "cancelled reservation with an empty open folio",
    remedy: "closes itself on cancel now; existing rows need closing",
    sql: `SELECT count(*)::int AS rows FROM "Folio" f
          JOIN "Reservation" r ON r.id = f."reservationId"
          WHERE r.status = 'cancelled' AND f.status = 'open'
            AND NOT EXISTS (SELECT 1 FROM "FolioLine" l WHERE l."folioId" = f.id AND l.voided = false)`,
  },
  {
    id: "closed_folio_no_outcome",
    fault: "closed folio with no recorded outcome",
    remedy: "repair-stuck-stays.sql sets it, or resolve it on the folio screen",
    sql: `SELECT count(*)::int AS rows FROM "Folio" WHERE status = 'closed' AND outcome IS NULL`,
  },
  {
    /*
     * ⚠️ `settled` ONLY. `paid_offsystem` and `written_off` deliberately post no folio line — a
     * write-off that posted a payment line would be counted as income by anything summing payments,
     * which `folio-outcomes.ts` exists to make impossible. Their balance stays non-zero on purpose
     * and the OUTCOME carries the meaning. Including them reported two healthy folios as faults on
     * every run, and a check that fires on correct data teaches people to ignore the one that fires
     * on real damage.
     */
    id: "settled_with_balance",
    fault: "folio marked settled that still carries a balance",
    remedy: "reopen and resolve it on the folio screen",
    sql: `SELECT count(*)::int AS rows FROM "Folio" f
          WHERE f.outcome = 'settled'
            AND COALESCE((SELECT sum(CASE WHEN l.kind = 'payment' THEN -l."amountMinor" ELSE l."amountMinor" END)
                          FROM "FolioLine" l WHERE l."folioId" = f.id AND l.voided = false), 0) <> 0`,
  },
  {
    id: "departed_folio_open",
    fault: "departed stay with a folio still open",
    remedy: "close it from the folio screen so it reaches receivables",
    sql: `SELECT count(*)::int AS rows FROM "Folio" f
          JOIN "Reservation" r ON r.id = f."reservationId"
          WHERE r."departedAt" IS NOT NULL AND f.status = 'open'`,
  },
  {
    id: "overstayed",
    fault: "genuinely overstayed (past departure, never checked out)",
    remedy: "front desk: check them out, or extend the stay",
    sql: `SELECT count(*)::int AS rows FROM "Reservation" r
          WHERE r."departedAt" IS NULL AND r.status IN ('confirmed', 'modified', 'overbooked')
            AND EXISTS (SELECT 1 FROM "RoomAssignment" a
                        WHERE a."reservationId" = r.id AND a.status = 'active'
                          AND a."checkedOutAt" IS NULL AND a."checkOut" < CURRENT_DATE)`,
  },
  {
    id: "room_double_assigned",
    fault: "room double-assigned over overlapping nights",
    remedy: "front desk: move one of them",
    sql: `SELECT count(*)::int AS rows FROM (
            SELECT a1.id FROM "RoomAssignment" a1
            JOIN "RoomAssignment" a2
              ON a2."unitId" = a1."unitId" AND a2.id <> a1.id
             AND a1."checkIn" < a2."checkOut" AND a2."checkIn" < a1."checkOut"
            WHERE a1.status = 'active' AND a1."checkedOutAt" IS NULL
              AND a2.status = 'active' AND a2."checkedOutAt" IS NULL
          ) dupes`,
  },
  {
    id: "charge_after_close",
    fault: "charge posted to a folio after it was closed",
    remedy: "void the line, or reopen and resolve the folio",
    sql: `SELECT count(*)::int AS rows FROM "FolioLine" l
          JOIN "Folio" f ON f.id = l."folioId"
          WHERE f.status = 'closed' AND f."closedAt" IS NOT NULL
            AND l."postedAt" > f."closedAt" AND l.voided = false`,
  },
] as const;

export interface StateFault extends Omit<StateCheck, "sql"> {
  rows: number;
}

/** Just the slice needed to run a raw read — a `withSystemTransaction` tx satisfies it. */
export interface RawReader {
  $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T>;
}

/**
 * Run every check. ⚠️ Give it a tx from `withSystemTransaction`, never `forSystem()` — see the note
 * at the top of this file about raw reads returning zero rows under RLS.
 */
export async function runStateAudit(tx: RawReader): Promise<StateFault[]> {
  const out: StateFault[] = [];
  for (const { sql, ...rest } of STATE_CHECKS) {
    const result = await tx.$queryRawUnsafe<{ rows: number }[]>(sql);
    out.push({ ...rest, rows: Number(result[0]?.rows ?? 0) });
  }
  return out;
}

/**
 * What to say about a run, in one object.
 *
 * Pure, so the wording is testable without a database. `healthy` is the state worth naming out loud:
 * zero everywhere is the goal and a screen should be able to say so rather than render an empty list
 * that reads like something failed to load.
 */
export function faultSummary(faults: readonly StateFault[]): {
  healthy: boolean;
  totalRows: number;
  failing: StateFault[];
} {
  const failing = faults.filter((f) => f.rows > 0).sort((a, b) => b.rows - a.rows || a.fault.localeCompare(b.fault));
  return {
    healthy: failing.length === 0,
    totalRows: failing.reduce((s, f) => s + f.rows, 0),
    failing,
  };
}
