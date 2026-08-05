/**
 * The relationship half of a client record — the part that is about people rather than data.
 *
 * `clientAttention` answers "is something wrong with their account". `clientOpportunities` answers
 * "what should I sell them". Neither answers the three questions actually asked at the moment someone
 * picks up the phone: **who do I call, when does this renew, and what was said last time.** Those are
 * not derivable from the platform's data — they have to be written down — which is why L6 needs
 * storage where L1–L5 needed none.
 *
 * What IS derivable is whether the written-down version still matches reality, and that is the whole
 * design of this module. A stage typed in six months ago is a belief; the booking data is a fact. A
 * CRM that auto-computes the stage silently overwrites the belief; one that never checks it lets the
 * belief rot. This one keeps both and **reports the disagreement**, which is the only version that
 * tells you something you did not already know.
 *
 * Pure and tested, for the same reason as its three siblings: every threshold here is a judgement
 * that will be argued with once there are real customers.
 */

import type { AttentionFlag, Severity } from "./attention.js";

export const STAGES = ["prospect", "onboarding", "live", "at_risk", "churned"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  live: "Live",
  at_risk: "At risk",
  churned: "Churned",
};

/** Kinds of timeline entry. Only the first three count as *contact* — see `lastContactAt`. */
export const NOTE_KINDS = ["call", "email", "meeting", "note", "issue"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_LABEL: Record<NoteKind, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  issue: "Issue",
};

/**
 * Talking TO them, as opposed to writing something down ABOUT them. The distinction is the entire
 * point of the staleness flag below: a console that counted internal notes as contact would report a
 * warm relationship with a customer nobody has actually spoken to since March.
 */
export const CONTACT_KINDS: readonly string[] = ["call", "email", "meeting"];

const DAY = 86_400_000;
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY);
const daysUntil = (d: Date, now: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY);

/** Matches `clientAttention` — nothing is expected of a client in its first fortnight. */
const GRACE_DAYS = 14;
/** Set up, paid for, and still never used after this long is not onboarding any more. */
const NEVER_USED_DAYS = 60;
/** No booking in this long, having taken them before. */
const QUIET_DAYS = 30;
/** Quiet this long is not a slow month. */
const GONE_DAYS = 90;
/** A paying customer nobody has spoken to in this long is one an account manager has lost track of. */
const STALE_CONTACT_DAYS = 90;
/** Renewal inside this window is this week's work. */
const RENEWAL_ACT_DAYS = 30;
/** Renewal inside this window is next month's work. */
const RENEWAL_SOON_DAYS = 60;

export interface StageSignals {
  status: string; // active | suspended
  createdAt: Date;
  properties: number;
  roomTypes: number;
  /** Newest reservation from any source, or null if they have never taken one. */
  lastReservationAt: Date | null;
}

/**
 * The stage the DATA says they are in, computed from behaviour alone and never written anywhere.
 *
 * It exists to be compared against the stated stage, not to replace it. `prospect` is deliberately
 * unreachable here: whether someone is a prospect is a commercial fact about a conversation, and no
 * amount of booking data can tell you.
 */
export function observedStage(s: StageSignals, now: Date = new Date()): Stage {
  const age = daysSince(s.createdAt, now);
  const quiet = s.lastReservationAt ? daysSince(s.lastReservationAt, now) : null;

  const behaviour = ((): Stage => {
    // Nothing to sell yet — still standing it up, however long that has taken.
    if (s.properties === 0 || s.roomTypes === 0) return age > NEVER_USED_DAYS ? "at_risk" : "onboarding";
    if (quiet === null) return age > NEVER_USED_DAYS ? "at_risk" : "onboarding";
    if (quiet < QUIET_DAYS) return "live";
    if (quiet < GONE_DAYS) return "at_risk";
    return "churned";
  })();

  // A locked account is never reported as live, whatever last month's bookings say — the bookings
  // happened before we turned the key.
  if (s.status === "suspended" && (behaviour === "live" || behaviour === "onboarding")) return "at_risk";
  return behaviour;
}

export interface RenewalStatus {
  /** Negative when the date has already passed. */
  days: number;
  severity: Severity;
  label: string;
}

/**
 * How close a renewal is, in the only terms that matter — how soon someone has to do something.
 * `null` when it is far enough away to be nobody's problem this month.
 */
export function renewalStatus(renewalDate: Date | null, now: Date = new Date()): RenewalStatus | null {
  if (!renewalDate) return null;
  const days = daysUntil(renewalDate, now);
  if (days < 0) return { days, severity: "act", label: `Renewal date passed ${-days} day${days === -1 ? "" : "s"} ago` };
  if (days === 0) return { days, severity: "act", label: "Renews today" };
  if (days <= RENEWAL_ACT_DAYS) return { days, severity: "act", label: `Renews in ${days} days` };
  if (days <= RENEWAL_SOON_DAYS) return { days, severity: "soon", label: `Renews in ${days} days` };
  return null;
}

/**
 * Move a renewal date forward one contract term. Used when an operator marks a client renewed, so the
 * date advances instead of being retyped — a renewal date that has to be edited by hand is a renewal
 * date that ends up permanently in the past, and then the flag above cries wolf forever.
 *
 * Anchored on the OLD renewal date, not today: a contract renewed three days late still renews on its
 * anniversary next year. Day-of-month is clamped, so 31 January + 1 month is 28/29 February rather
 * than rolling into March.
 */
export function rollRenewal(renewalDate: Date, termMonths: number): Date {
  const months = termMonths > 0 ? termMonths : 12;
  const y = renewalDate.getUTCFullYear();
  const m = renewalDate.getUTCMonth();
  const d = renewalDate.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + months, Math.min(d, lastDayOfTarget)));
}

export interface NoteLike {
  kind: string;
  occurredAt: Date;
}

/** The last time we actually spoke to them. Internal notes do not count — see `CONTACT_KINDS`. */
export function lastContactAt(notes: readonly NoteLike[]): Date | null {
  let latest: Date | null = null;
  for (const n of notes) {
    if (!CONTACT_KINDS.includes(n.kind)) continue;
    if (!latest || n.occurredAt.getTime() > latest.getTime()) latest = n.occurredAt;
  }
  return latest;
}

export interface AccountSignals {
  status: string; // tenant status: active | suspended
  createdAt: Date;
  /** What we say they are. */
  stage: Stage;
  /** What the data says they are — from `observedStage`. */
  observed: Stage;
  renewalDate: Date | null;
  lastContactAt: Date | null;
  /** Whether anyone at all is recorded as the person to call. */
  hasPrimaryContact: boolean;
  monthlyPriceMinor: number;
}

/**
 * Attention flags that come from the RELATIONSHIP rather than the platform.
 *
 * Kept out of `clientAttention` on purpose: that function is about whether their software is working,
 * this one is about whether we are looking after them. Callers concatenate the two and sort once.
 */
export function accountAttention(a: AccountSignals, now: Date = new Date()): AttentionFlag[] {
  // The same rule `clientAttention` applies to a suspension, restated because it is easy to lose when
  // two flag sources are concatenated: nothing else is worth saying about a locked-out account.
  if (a.status === "suspended") return [];

  const flags: AttentionFlag[] = [];
  const age = daysSince(a.createdAt, now);

  // --- the contract ------------------------------------------------------
  if (a.stage !== "churned") {
    const r = renewalStatus(a.renewalDate, now);
    if (r) {
      flags.push({
        severity: r.severity,
        title: r.label,
        detail:
          r.days < 0
            ? "The contract date has gone by without being marked renewed. Confirm it, or the account is running unpapered."
            : "Renewal conversations start before the date, not on it.",
      });
    }
  }

  // --- the belief vs the behaviour ---------------------------------------
  // Both directions are worth knowing, and the bad-news direction is the one that would otherwise be
  // found out at renewal.
  if (a.stage === "live" && (a.observed === "at_risk" || a.observed === "churned")) {
    flags.push({
      severity: a.observed === "churned" ? "act" : "soon",
      title: `Marked live, behaving ${a.observed === "churned" ? "churned" : "at risk"}`,
      detail: "Their usage stopped and the account record has not caught up. Find out which is true.",
    });
  } else if (a.stage === "prospect" && a.observed === "live" && a.monthlyPriceMinor === 0) {
    // Revenue leaking in the most embarrassing way: a live hotel nobody is invoicing.
    flags.push({
      severity: "act",
      title: "Marked prospect but live",
      detail: "They are taking bookings on the platform and are billed nothing. Either close them or stop the service.",
    });
  } else if (
    (a.stage === "at_risk" || a.stage === "churned") &&
    a.observed === "live"
  ) {
    flags.push({
      severity: "note",
      title: `Marked ${a.stage === "churned" ? "churned" : "at risk"}, behaving live`,
      detail: "Usage recovered. Good news to open a call with, and the stage is out of date.",
    });
  }

  // --- are we actually looking after them --------------------------------
  if (!a.hasPrimaryContact && age > GRACE_DAYS) {
    flags.push({
      severity: "soon",
      title: "No one to call",
      detail: "No primary contact recorded. An account you cannot phone is an account you cannot save.",
    });
  } else if (a.monthlyPriceMinor > 0 && a.stage !== "churned") {
    const since = a.lastContactAt ? daysSince(a.lastContactAt, now) : null;
    if (since === null && age > STALE_CONTACT_DAYS) {
      flags.push({
        severity: "soon",
        title: "Never contacted",
        detail: `Paying for ${Math.floor(age / 30)} month(s) with no call, email or meeting ever logged.`,
      });
    } else if (since !== null && since >= STALE_CONTACT_DAYS) {
      flags.push({
        severity: "soon",
        title: `No contact in ${since} days`,
        detail: "A paying customer nobody has spoken to since then. Renewals are lost in these gaps.",
      });
    }
  }

  return flags;
}

export interface TimelineItem {
  id: string;
  at: Date;
  kind: string;
  title: string;
  detail?: string;
  author?: string;
  pinned?: boolean;
}

/**
 * One relationship log, newest first.
 *
 * **Future-dated entries are excluded, not sorted in.** The renewal date is the obvious case: it is a
 * real event with a real date, and dropping it into a list headed "what has happened" puts next
 * March above last week's call. Upcoming things are shown as upcoming, elsewhere.
 *
 * Ties break by id so the order is stable across renders — two things logged in the same second must
 * not swap places when the page refreshes.
 */
export function buildTimeline(items: readonly TimelineItem[], now: Date = new Date()): TimelineItem[] {
  return items
    .filter((i) => i.at.getTime() <= now.getTime())
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}
