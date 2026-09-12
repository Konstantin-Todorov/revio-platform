/**
 * What RevioDirect actually does, measured — the hotel's own funnel.
 *
 * ## Why this can be built at all
 *
 * The booking engine takes a hold the moment a guest opens the booking form (K4, "hold-on-open"),
 * and that hold records its own ending: `converted` when they booked, `released` when they left the
 * form deliberately, `expired` when they simply stopped. So a funnel already exists in the
 * database — it has just never been read. Nothing new is captured here.
 *
 * ## ⚠️ Sessions, not holds — this is the difference between a number and a wrong number
 *
 * A guest who opens the Deluxe, goes back, and books the Standard leaves the Deluxe hold to expire.
 * Counted by hold, one person making one booking reads as **one conversion and one abandonment**,
 * and the conversion rate comes out at roughly half the truth. Counted by session — which is what
 * `Hold.sessionId` exists for — that is one session that converted, because one decision was made.
 *
 * A session's outcome is the best thing that happened in it: booked beats still-looking beats left.
 * Anything without a session id (every staff hold, and any row older than the migration that added
 * the column) is its own session, which is correct for staff: a receptionist holding two rooms
 * really is holding two rooms.
 *
 * ## ⚠️ Sessions still in progress are excluded from the rate, not counted as failures
 *
 * A guest filling in the form right now has not abandoned anything. Counting them against us makes
 * the conversion rate sag every time somebody is mid-booking and makes the figure depend on the
 * minute you looked at it. They are reported separately, as work in flight.
 *
 * ## Left deliberately vs simply stopped
 *
 * Both are abandonment and they are **not the same event**. `released` is a guest who saw the total
 * and pressed back — that is a price or a trust problem. `expired` is a guest who was interrupted —
 * that is a recovery problem, and the one an email can still win back. Reporting them as one number
 * hides which of the two fixes is worth doing, so they stay apart everywhere.
 */

export type HoldStatus = "active" | "converted" | "released" | "expired";

export interface FunnelHold {
  status: HoldStatus;
  /** Null for staff holds and for anything created before sessions were recorded. */
  sessionId?: string | null;
  roomTypeId: string;
  /** When the guest opened the form. */
  createdAt: Date;
  /** The stay they were looking at — present even when they never booked it, which is the point. */
  checkIn: string;
  checkOut: string;
}

export type SessionOutcome = "booked" | "left" | "stopped" | "looking";

export interface FunnelSession {
  key: string;
  outcome: SessionOutcome;
  /** Every room type opened in this session, in order — the comparison the guest actually made. */
  roomTypeIds: string[];
  /** The room type the outcome belongs to: the one booked, or the last one they looked at. */
  decidedRoomTypeId: string;
  createdAt: Date;
  checkIn: string;
  checkOut: string;
}

/** Best outcome wins: a session that booked is a booking, whatever else it looked at on the way. */
const OUTCOME_RANK: Record<SessionOutcome, number> = { booked: 3, looking: 2, left: 1, stopped: 0 };

function outcomeOf(status: HoldStatus): SessionOutcome {
  switch (status) {
    case "converted": return "booked";
    case "active": return "looking";
    case "released": return "left";
    case "expired": return "stopped";
  }
}

/**
 * Holds → the sessions they belonged to.
 *
 * Holds arrive in any order; a session takes the earliest `createdAt` it saw (when it began) and
 * the stay dates of the hold that decided it.
 */
export function funnelSessions(holds: FunnelHold[]): FunnelSession[] {
  const byKey = new Map<string, FunnelSession>();

  // Oldest first, so `roomTypeIds` reads as the order the guest opened them.
  const ordered = [...holds].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const [i, h] of ordered.entries()) {
    // No session id → its own session. Index keeps two such holds from colliding.
    const key = h.sessionId ?? `hold:${i}:${h.createdAt.getTime()}:${h.roomTypeId}`;
    const outcome = outcomeOf(h.status);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        key,
        outcome,
        roomTypeIds: [h.roomTypeId],
        decidedRoomTypeId: h.roomTypeId,
        createdAt: h.createdAt,
        checkIn: h.checkIn,
        checkOut: h.checkOut,
      });
      continue;
    }

    if (!existing.roomTypeIds.includes(h.roomTypeId)) existing.roomTypeIds.push(h.roomTypeId);
    if (h.createdAt < existing.createdAt) existing.createdAt = h.createdAt;

    if (OUTCOME_RANK[outcome] > OUTCOME_RANK[existing.outcome]) {
      existing.outcome = outcome;
      // The stay that was actually decided on, which need not be the one they opened first.
      existing.decidedRoomTypeId = h.roomTypeId;
      existing.checkIn = h.checkIn;
      existing.checkOut = h.checkOut;
    }
  }

  return [...byKey.values()];
}

export interface FunnelTotals {
  /** Sessions that reached the booking form at all. */
  started: number;
  booked: number;
  /** Pressed back / left the form. A price or trust signal. */
  left: number;
  /** Ran out of time. The ones an email can still win back. */
  stopped: number;
  /** Still filling it in. Never counted as a failure. */
  looking: number;
  /** booked ÷ decided sessions, 0–1. `null` when nobody has decided yet. */
  conversionRate: number | null;
  /** Sessions that reached an ending — the honest denominator. */
  decided: number;
}

export function funnelTotals(sessions: FunnelSession[]): FunnelTotals {
  const count = (o: SessionOutcome) => sessions.filter((s) => s.outcome === o).length;
  const booked = count("booked");
  const left = count("left");
  const stopped = count("stopped");
  const looking = count("looking");
  const decided = booked + left + stopped;
  return {
    started: sessions.length,
    booked, left, stopped, looking,
    decided,
    // `null`, never 0. "No conversion" and "nobody has finished deciding" are different facts, and
    // a 0% on an empty week reads as a catastrophe rather than as silence.
    conversionRate: decided === 0 ? null : booked / decided,
  };
}

export interface RoomTypeFunnelRow {
  roomTypeId: string;
  sessions: number;
  booked: number;
  /** Against THIS room's own sessions — see the note below. */
  conversionRate: number | null;
}

/**
 * Per room type.
 *
 * ⚠️ Each room's rate is booked ÷ **its own** sessions, never ÷ all sessions. Divide by the total
 * and the room nobody opens always looks like the worst performer, when what it actually has is a
 * visibility problem — the opposite diagnosis, and the opposite fix.
 *
 * A session is attributed to the room it DECIDED on, so comparing three rooms and booking one
 * credits the booking to the room that won rather than spreading it over the three that were seen.
 */
export function funnelByRoomType(sessions: FunnelSession[]): RoomTypeFunnelRow[] {
  const rows = new Map<string, { sessions: number; booked: number; decided: number }>();
  for (const s of sessions) {
    const r = rows.get(s.decidedRoomTypeId) ?? { sessions: 0, booked: 0, decided: 0 };
    r.sessions++;
    if (s.outcome === "booked") r.booked++;
    if (s.outcome !== "looking") r.decided++;
    rows.set(s.decidedRoomTypeId, r);
  }
  return [...rows.entries()]
    .map(([roomTypeId, r]) => ({
      roomTypeId,
      sessions: r.sessions,
      booked: r.booked,
      conversionRate: r.decided === 0 ? null : r.booked / r.decided,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

const DAY_MS = 86_400_000;

/** Nights, from the stay a session was looking at — booked or not. */
export function sessionNights(s: FunnelSession): number {
  return Math.round((Date.parse(`${s.checkOut}T00:00:00Z`) - Date.parse(`${s.checkIn}T00:00:00Z`)) / DAY_MS);
}

/** Days between looking and arriving. Negative is impossible and clamps to 0 (a same-day booking). */
export function sessionLeadDays(s: FunnelSession): number {
  const opened = Date.parse(`${toISODate(s.createdAt)}T00:00:00Z`);
  const arrive = Date.parse(`${s.checkIn}T00:00:00Z`);
  return Math.max(0, Math.round((arrive - opened) / DAY_MS));
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface FunnelComparison {
  /** Median over sessions that booked. `null` when none did. */
  booked: number | null;
  /** Median over sessions that ended without booking. `null` when none did. */
  abandoned: number | null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * What people who booked were looking at, against what people who left were looking at.
 *
 * The median rather than the mean: one corporate block of 40 nights would otherwise move the
 * "average stay" of a small hotel by more than every real guest in the month.
 *
 * This is the comparison the hold table makes possible and a reservation table cannot — an
 * abandoned stay has no reservation, so the dates people *wanted* are only recorded here.
 */
export function funnelStayComparison(sessions: FunnelSession[]): {
  nights: FunnelComparison;
  leadDays: FunnelComparison;
} {
  const booked = sessions.filter((s) => s.outcome === "booked");
  const abandoned = sessions.filter((s) => s.outcome === "left" || s.outcome === "stopped");
  return {
    nights: {
      booked: median(booked.map(sessionNights)),
      abandoned: median(abandoned.map(sessionNights)),
    },
    leadDays: {
      booked: median(booked.map(sessionLeadDays)),
      abandoned: median(abandoned.map(sessionLeadDays)),
    },
  };
}
