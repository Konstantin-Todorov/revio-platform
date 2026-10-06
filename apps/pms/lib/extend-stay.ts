import type { ChargeLine, StayShape } from "@revio/core";

/**
 * Extending a stay by dragging its end on the calendar — the pure half (§2.5's fast-follow).
 *
 * The founder's rules, 2026-10-06:
 *   - The added nights are priced at the stay's OWN rate plan, today's price for those dates.
 *     Reception sees the number before confirming and may change it.
 *   - A booking that came from a channel is NOT edited. The OTA owns that reservation — it will
 *     overwrite our dates on the next modification it sends, and the commission is theirs to
 *     invoice. The extra nights become a SEPARATE reservation in the same room, linked to the first
 *     and payable at the hotel.
 *   - Direct and phone bookings are extended in place.
 *   - Extending only. Shortening a stay is a refund question and has its own flow.
 *
 * Everything that decides a number lives here so it can be tested without a database.
 */

export type ExtensionMode = "extend" | "linked";

/**
 * Edit the reservation, or open a linked one beside it?
 *
 * A channel booking is the channel's record. So is a line of several rooms: extending the line would
 * extend every room on it, when the guest asking at the desk is in one of them.
 */
export function extensionMode(r: { channelId: string | null; paymentGuarantee: string | null }, lineQuantity: number): ExtensionMode {
  if (r.channelId != null || r.paymentGuarantee === "prepaid_ota") return "linked";
  if (lineQuantity > 1) return "linked";
  return "extend";
}

/** The nights added when a stay leaving on `checkOut` leaves on `newCheckOut` instead. */
export function addedNights(checkOut: string, newCheckOut: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${newCheckOut}T00:00:00Z`);
  for (let t = Date.parse(`${checkOut}T00:00:00Z`); t < end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Spread a total reception typed over the nights, keeping the shape of the quote.
 *
 * Proportional rather than even: a Friday quoted higher than a Thursday stays higher after a
 * discount, so the folio and the night audit still read like the rate calendar. Rounding goes to the
 * last night so the parts always sum to exactly what was typed.
 */
export function spreadTotal(quoted: readonly number[], totalMinor: number): number[] {
  const n = quoted.length;
  if (n === 0) return [];
  const sum = quoted.reduce((s, q) => s + q, 0);
  const parts = sum > 0
    ? quoted.map((q) => Math.floor((q * totalMinor) / sum))
    : quoted.map(() => Math.floor(totalMinor / n));
  const drift = totalMinor - parts.reduce((s, p) => s + p, 0);
  parts[n - 1] = parts[n - 1]! + drift;
  return parts;
}

/**
 * What the extension adds to the stay's fees — the difference, never a second full set.
 *
 * A per-stay fee was charged once and the stay is still one stay, so it adds nothing; a per-night
 * fee and the tourist tax add the new nights; a percentage adds its share of the new accommodation.
 * Computing "after minus before" through the same engine gets all of those right without this file
 * having to know which basis is which.
 */
export function feeDelta(before: readonly ChargeLine[], after: readonly ChargeLine[]): ChargeLine[] {
  const was = new Map(before.map((l) => [`${l.kind}:${l.name}`, l.amountMinor]));
  const out: ChargeLine[] = [];
  for (const l of after) {
    const diff = l.amountMinor - (was.get(`${l.kind}:${l.name}`) ?? 0);
    if (diff > 0) out.push({ ...l, amountMinor: diff });
  }
  return out;
}

export interface ShapeLine {
  checkIn: Date;
  checkOut: Date;
  quantity: number;
  guestsCount: number | null;
  childrenCount: number;
  infantsCount: number;
}

/** The stay as the fee engine sees it — the same reading the folio is seeded with. */
export function stayShapeOf(lines: readonly ShapeLine[], accommodationMinor: number): StayShape {
  let rooms = 0, guests = 0, persons = 0;
  for (const l of lines) {
    rooms += l.quantity;
    guests += l.guestsCount ?? l.quantity;
    persons += (l.guestsCount ?? l.quantity) + l.childrenCount + l.infantsCount;
  }
  const nights = lines.length
    ? Math.max(1, Math.round((Math.max(...lines.map((l) => l.checkOut.getTime())) - Math.min(...lines.map((l) => l.checkIn.getTime()))) / 86_400_000))
    : 1;
  return { accommodationMinor, nights, rooms, guests, persons };
}
