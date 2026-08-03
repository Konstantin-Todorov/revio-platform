/**
 * The availability waterfall — the CRS extension of computeAvailability (docs/CRS-REFERENCE.md
 * "System rules"). Lives ONCE here; every screen (CM calendar, CRS Inventory Calendar, Availability
 * Search, Dashboard) calls these functions and never re-derives locally.
 *
 *   physical − outOfOrder − closed         = available   (what CAN be sold)
 *   available − holds − confirmed          = remaining   (what a new booking may still take)
 *
 * The CM's date-level "rooms to sell" (DailyCell.inventory) is a manual override of the FIRST line:
 * when the hotel sets it, it replaces (physical − ooo − closed) as the sellable base for that date.
 * This keeps the CM's existing model as-is — OOO/closures are additive, not a rewrite.
 */

export interface WaterfallInput {
  /** RoomType.totalRooms — the permanent physical count. */
  physical: number;
  /** Units out of order (maintenance) on this date. */
  outOfOrder?: number;
  /** Units closed (seasonal closure etc.) on this date. */
  closed?: number;
  /** DailyCell.inventory — the hotel's manual "rooms to sell" override, if set for this date. */
  manualSellLimit?: number | null;
  /** Active hold units covering this date (temporary locks placed at room selection). */
  holds?: number;
  /** Confirmed reservation units covering this date (SOLD_STATUSES). */
  confirmed?: number;
}

export interface WaterfallResult {
  physical: number;
  outOfOrder: number;
  closed: number;
  /** Sellable base after OOO/closures — or the manual override when one is set. Never negative. */
  available: number;
  holds: number;
  confirmed: number;
  /** available − holds − confirmed. May go negative: that IS the overbooking signal. */
  remaining: number;
}

export function computeWaterfall(input: WaterfallInput): WaterfallResult {
  const physical = input.physical;
  const outOfOrder = input.outOfOrder ?? 0;
  const closed = input.closed ?? 0;
  const holds = input.holds ?? 0;
  const confirmed = input.confirmed ?? 0;

  const base = Math.max(0, physical - outOfOrder - closed);
  const available = input.manualSellLimit != null ? input.manualSellLimit : base;
  const remaining = available - holds - confirmed;

  return { physical, outOfOrder, closed, available, holds, confirmed, remaining };
}

/**
 * Reservation statuses that count as **sold** — a booking the hotel has money coming for.
 * "modified" = a confirmed reservation that was modified (flag-as-status); "overbooked" still
 * occupies a room; "no_show" counts as sold by default (the room was held and usually charged —
 * PropertyDefaults.countNoShowsAsSold toggles it OFF in metric queries only).
 */
export const SOLD_STATUSES = ["confirmed", "modified", "overbooked", "no_show"] as const;

/**
 * Reservation statuses that **occupy a room** — the availability question, which is not the same
 * question as "is it sold".
 *
 * A request-to-book (`requested`) is the case that forced these apart. It arrives when a hotel has
 * not finished connecting its Stripe account, so the guest could not leave a card guarantee and the
 * hotel has not accepted the stay yet. It is emphatically **not a sale** — counting it in pickup or
 * ADR would report revenue the hotel has not agreed to. But the room is spoken for: if a request did
 * not occupy it, the same night stays on sale on Booking.com and the hotel accepts a request for a
 * room an OTA has meanwhile sold. That is the exact double-booking this platform exists to prevent,
 * so the room is held from the moment the request lands and released only if the hotel declines.
 *
 * Use this for **anything that decides whether a room can be sold** — the waterfall, the calendar,
 * the ARI push. Use `SOLD_STATUSES` for anything that counts money or greets a guest.
 */
export const ROOM_OCCUPYING_STATUSES = [...SOLD_STATUSES, "requested"] as const;

export interface InventoryPeriodLike {
  kind: string; // out_of_order | closure
  dateFrom: string; // YYYY-MM-DD, inclusive
  dateTo: string; // YYYY-MM-DD, inclusive
  rooms: number;
}

/**
 * Expand OOO/closure periods into per-date counts for a run of calendar dates.
 * Dates are calendar strings (YYYY-MM-DD) so lexicographic compare is date compare.
 */
export function expandInventoryPeriods(
  periods: InventoryPeriodLike[],
  dates: string[],
): Map<string, { outOfOrder: number; closed: number }> {
  const out = new Map(dates.map((d) => [d, { outOfOrder: 0, closed: 0 }]));
  for (const p of periods) {
    for (const d of dates) {
      if (d < p.dateFrom || d > p.dateTo) continue;
      const cell = out.get(d)!;
      if (p.kind === "out_of_order") cell.outOfOrder += p.rooms;
      else cell.closed += p.rooms;
    }
  }
  return out;
}
