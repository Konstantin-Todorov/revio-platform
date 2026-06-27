/**
 * Advance-Purchase restriction — a rate-plan-level rule that "rolls" with today.
 *
 * A rate plan can require a booking to be made within a window before arrival:
 *   - Min N  → the stay must be booked at least N days ahead, so the NEXT N days auto-close
 *              (lead time 0…N-1 closed). e.g. Min 3 closes today, +1, +2.
 *   - Max N  → the stay must be booked at most N days ahead, so everything BEYOND N days auto-closes
 *              (lead time N+1…∞ closed). e.g. Max 3 closes +4, +5, …
 * Because the window is measured from "today", the closed dates shift forward each day ("rolling
 * auto-close"). This is computed, not stored — the calendar/push derive it live.
 *
 * Pure functions only — see packages/core/CLAUDE.md. "Today" is resolved at the property timezone.
 */

import type { IsoDate } from "../domain/types.js";

const DAY_MS = 86_400_000;

/** Whole days from `today` to `date` (both `YYYY-MM-DD`, compared in UTC). Negative if `date` is past. */
export function leadDays(today: IsoDate, date: IsoDate): number {
  const t = Date.parse(`${today}T00:00:00Z`);
  const d = Date.parse(`${date}T00:00:00Z`);
  return Math.round((d - t) / DAY_MS);
}

export interface AdvancePurchaseWindow {
  /** Book at least this many days before arrival; closer dates auto-close. Null/undefined = no minimum. */
  min?: number | null;
  /** Book at most this many days before arrival; further dates auto-close. Null/undefined = no maximum. */
  max?: number | null;
}

/** Whether `date` is auto-closed by the advance-purchase window, as of `today` (a rolling stop-sell). */
export function isAdvancePurchaseClosed(today: IsoDate, date: IsoDate, window: AdvancePurchaseWindow): boolean {
  const lead = leadDays(today, date);
  if (window.min != null && lead < window.min) return true; // too close to arrival
  if (window.max != null && lead > window.max) return true; // too far ahead
  return false;
}
