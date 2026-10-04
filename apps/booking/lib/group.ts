import "server-only";
import type { PublicPlanQuote, PublicRoomOption } from "@revio/booking";
import { serializeRoomParties, serializeRoomPicks, type RoomParty, type RoomPick } from "@revio/core";
import type { PublicProperty } from "./property";
import { searchAvailability } from "./availability";

/**
 * Several rooms in one booking — the shared helpers for the results page, the booking step and the
 * actions.
 *
 * Each room is searched with ITS OWN party (a family room for the parents and children, a twin for
 * the grandparents) and becomes its own reservation, grouped by `bookingGroupId`. A room type picked
 * for an earlier slot counts against the same type for a later one, so two slots can never be sold
 * the last room twice on this page; the holds then make it true in the database.
 */
export interface GroupItem {
  party: RoomParty;
  pick: RoomPick;
  option: PublicRoomOption;
  plan: PublicPlanQuote;
}

export function groupQuery(q: { checkIn: string; checkOut: string; rooms: RoomParty[]; picks?: RoomPick[] }): string {
  const sel = q.picks?.length ? `&sel=${encodeURIComponent(serializeRoomPicks(q.picks))}` : "";
  return `checkIn=${q.checkIn}&checkOut=${q.checkOut}&rooms=${encodeURIComponent(serializeRoomParties(q.rooms))}${sel}`;
}

/** Every picked room re-priced for its own party now. Null when any of them is no longer bookable. */
export async function loadGroup(
  property: PublicProperty, ip: string,
  q: { checkIn: string; checkOut: string; rooms: RoomParty[]; picks: RoomPick[] },
): Promise<GroupItem[] | null> {
  if (q.picks.length !== q.rooms.length) return null;
  const items: GroupItem[] = [];
  for (let i = 0; i < q.rooms.length; i++) {
    const party = q.rooms[i]!;
    const pick = q.picks[i]!;
    const outcome = await searchAvailability(property, ip, {
      checkIn: q.checkIn, checkOut: q.checkOut, guests: party.adults, childAges: party.childAges,
    });
    const option = (outcome.options ?? []).find((o) => o.roomTypeId === pick.roomTypeId);
    const plan = option?.plans.find((p) => p.ratePlanId === pick.ratePlanId);
    if (!option || !plan) return null;
    // The same type picked for more slots than it has rooms left.
    const sameType = q.picks.slice(0, i + 1).filter((p) => p.roomTypeId === pick.roomTypeId).length;
    if (sameType > option.remaining) return null;
    items.push({ party, pick, option, plan });
  }
  return items;
}

/** What leaves the card today for the whole group: each room's own terms, summed. */
export function groupPayNowMinor(items: GroupItem[]): number {
  return items.reduce((n, it) => n + (it.plan.terms?.payNowMinor ?? 0), 0);
}

export function groupTotalMinor(items: GroupItem[]): number {
  return items.reduce((n, it) => n + it.plan.totalMinor, 0);
}
