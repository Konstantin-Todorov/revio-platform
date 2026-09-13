/**
 * Choosing which rate plans a bulk edit applies to — one room-type tree, not two lists.
 *
 * ## The defect the shape causes
 *
 * Bulk Update has two independent blocks: room types (checkboxes) and rate plans (checkboxes). That
 * split makes the relationship invisible, and it produced BUG-022 on 13 September — both plan
 * checkboxes rendered a truncated list of room types instead of their own names, so the one screen
 * where you choose between two plans showed them as identical.
 *
 * It is the same property-scoped-vs-room-scoped mismatch as BUG-019: the selector treats rate plans
 * as property-level objects while every operation it drives is room-scoped.
 *
 * ## ⚠️ SELECTION IS A SET OF PAIRS, AND FLATTENING IT LOSES INFORMATION
 *
 * Two lists can only express a rectangle. Pick *1-Bedroom · BB Flex* and *2-Bedroom · BB NR* in a
 * tree and then flatten to `rooms × plans`, and you get four pairs — applying the edit to two
 * combinations nobody chose, silently, at whatever price was typed.
 *
 * So a pair is the unit throughout, and `selectedPairs` is what the writer must be given.
 * `flattenLossy` exists only to answer "is this selection expressible as two lists", and is named
 * to be uncomfortable to call.
 */

export type CheckState = "checked" | "indeterminate" | "unchecked";

export interface SelectablePlan {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  /** `derived` plans follow a parent and are shown, greyed, never selected. */
  priceLogic: string;
  parentName?: string | null;
}

export interface SelectableRoom {
  id: string;
  name: string;
  code?: string;
  plans: SelectablePlan[];
}

export interface Pair {
  roomTypeId: string;
  ratePlanId: string;
}

export const pairKey = (roomTypeId: string, ratePlanId: string) => `${roomTypeId}|${ratePlanId}`;

/**
 * ⚠️ A room with NO selectable plan is still a valid scope, and forgetting that is a regression.
 *
 * Not every bulk field is priced per plan. Allocation and every restriction are written per ROOM
 * TYPE — `applyBulkUpdateMulti` loops `roomTypeIds` for those and `plansForRoom` only for price. So
 * a room type created five minutes ago with no rate plan linked yet, or one whose plans are all
 * derived, has nothing to tick in the tree and yet is exactly the room whose allocation somebody
 * needs to set.
 *
 * The two-list selector could express that (tick the room, tick no plan). A tree cannot, unless the
 * room itself can be selected — so it can, under this sentinel. It is NEVER a `Pair`: `selectedPairs`
 * filters it out, so nothing can mistake it for a plan id and write a price against it.
 */
export const ROOM_ONLY = "__room_only__";

/** True for a room the tree offers as a whole, because it has no plan to offer instead. */
export const isRoomOnly = (room: SelectableRoom) => selectablePlans(room).length === 0;

/**
 * Plans a person may actually tick on this room.
 *
 * ⚠️ Derived and inactive plans are **shown and not selectable**, never hidden. A plan you cannot
 * see is a plan you cannot reason about: the hotel needs to know BB NR exists and will follow BB
 * Flex, and that Standard Rate is switched off — otherwise "apply to the whole room" is a promise
 * whose scope nobody can check (§5.3 rules 3 and 4).
 */
export function selectablePlans(room: SelectableRoom): SelectablePlan[] {
  return room.plans.filter((p) => p.active && p.priceLogic !== "derived");
}

export function roomCheckState(room: SelectableRoom, selected: ReadonlySet<string>): CheckState {
  const options = selectablePlans(room);
  if (options.length === 0) return selected.has(pairKey(room.id, ROOM_ONLY)) ? "checked" : "unchecked";
  const on = options.filter((p) => selected.has(pairKey(room.id, p.id))).length;
  if (on === 0) return "unchecked";
  return on === options.length ? "checked" : "indeterminate";
}

/**
 * Ticking a room ticks its selectable plans; untangling it clears them.
 *
 * ⚠️ An indeterminate room goes to fully checked, not to cleared. Somebody who has picked one of
 * three plans and clicks the room is adding the rest — clearing their work would be the one
 * outcome they certainly did not intend.
 */
export function toggleRoom(room: SelectableRoom, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const options = selectablePlans(room);
  const state = roomCheckState(room, selected);
  if (options.length === 0) {
    const k = pairKey(room.id, ROOM_ONLY);
    if (state === "checked") next.delete(k);
    else next.add(k);
    return next;
  }
  for (const p of options) {
    const k = pairKey(room.id, p.id);
    if (state === "checked") next.delete(k);
    else next.add(k);
  }
  return next;
}

export function togglePlan(room: SelectableRoom, planId: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  // Refuses to select what cannot be applied — a derived plan follows its parent, an inactive one
  // sells nothing. Silently accepting the click would put it in the summary and in the payload.
  if (!selectablePlans(room).some((p) => p.id === planId)) return next;
  const k = pairKey(room.id, planId);
  if (next.has(k)) next.delete(k);
  else next.add(k);
  return next;
}

export function selectAll(rooms: readonly SelectableRoom[]): Set<string> {
  const next = new Set<string>();
  for (const r of rooms) {
    if (isRoomOnly(r)) { next.add(pairKey(r.id, ROOM_ONLY)); continue; }
    for (const p of selectablePlans(r)) next.add(pairKey(r.id, p.id));
  }
  return next;
}

export function invertSelection(rooms: readonly SelectableRoom[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set<string>();
  for (const r of rooms) {
    if (isRoomOnly(r)) {
      const k = pairKey(r.id, ROOM_ONLY);
      if (!selected.has(k)) next.add(k);
      continue;
    }
    for (const p of selectablePlans(r)) {
      const k = pairKey(r.id, p.id);
      if (!selected.has(k)) next.add(k);
    }
  }
  return next;
}

/** The pairs themselves — what the writer is given, and the only lossless form. */
export function selectedPairs(rooms: readonly SelectableRoom[], selected: ReadonlySet<string>): Pair[] {
  const out: Pair[] = [];
  for (const r of rooms) {
    for (const p of selectablePlans(r)) {
      if (selected.has(pairKey(r.id, p.id))) out.push({ roomTypeId: r.id, ratePlanId: p.id });
    }
  }
  return out;
}

export interface SelectionGroup {
  roomTypeId: string;
  roomTypeName: string;
  plans: { id: string; name: string }[];
  /** The room is in scope with no plan of its own — allocation and restrictions only. */
  roomOnly?: boolean;
}

/**
 * Every room type the edit touches — the `roomTypeIds` half of the payload.
 *
 * A room counts because one of its plans is ticked, OR because the room itself is (see `ROOM_ONLY`).
 * Restrictions and allocation are written from this list, so a room missing here is a room the
 * hotel selected and nothing happened to.
 */
export function roomsInSelection(rooms: readonly SelectableRoom[], selected: ReadonlySet<string>): string[] {
  return rooms
    .filter((r) =>
      selected.has(pairKey(r.id, ROOM_ONLY)) ||
      selectablePlans(r).some((p) => selected.has(pairKey(r.id, p.id))))
    .map((r) => r.id);
}

/**
 * What is about to change, grouped by room and individually removable.
 *
 * §5.1 calls this the most valuable part of the Trip.com pattern, and it is: the current Review
 * dialog is the ONLY place plan names appear correctly, and it comes after the choice is made.
 */
export function selectionSummary(rooms: readonly SelectableRoom[], selected: ReadonlySet<string>): SelectionGroup[] {
  const out: SelectionGroup[] = [];
  for (const r of rooms) {
    const plans = selectablePlans(r)
      .filter((p) => selected.has(pairKey(r.id, p.id)))
      .map((p) => ({ id: p.id, name: p.name }));
    if (plans.length > 0) out.push({ roomTypeId: r.id, roomTypeName: r.name, plans });
    else if (selected.has(pairKey(r.id, ROOM_ONLY))) out.push({ roomTypeId: r.id, roomTypeName: r.name, plans: [], roomOnly: true });
  }
  return out;
}

/** "Selected 2 rate plans across 1 room type" — §5.3 rule 8. */
export function selectionCount(groups: readonly SelectionGroup[]): string {
  const plans = groups.reduce((s, g) => s + g.plans.length, 0);
  const withPlans = groups.filter((g) => g.plans.length > 0).length;
  const roomOnly = groups.filter((g) => g.roomOnly).length;
  if (plans === 0 && roomOnly === 0) return "Nothing selected";
  // ⚠️ Never "0 rate plans": a room-only selection is a real, applicable edit, and reporting it as
  // zero is the same class of lie as "0 problems" on a check that ran against nothing.
  const bare = `${roomOnly} room type${roomOnly === 1 ? "" : "s"} with no editable plans`;
  if (plans === 0) return `Selected ${bare}`;
  const main = `Selected ${plans} rate plan${plans === 1 ? "" : "s"} across ${withPlans} room type${withPlans === 1 ? "" : "s"}`;
  return roomOnly === 0 ? main : `${main}, plus ${bare}`;
}

/**
 * ⚠️ Can this selection be written as two lists without changing what it means?
 *
 * It can only when the pairs form a complete rectangle. Anything else — the ordinary case as soon
 * as somebody picks different plans on different rooms — would silently gain combinations nobody
 * chose. Callers use this to decide whether the legacy `roomTypeIds × ratePlanIds` payload is safe,
 * and the answer is usually no.
 */
export function isRectangular(pairs: readonly Pair[]): boolean {
  if (pairs.length === 0) return true;
  const rooms = [...new Set(pairs.map((p) => p.roomTypeId))];
  const plans = [...new Set(pairs.map((p) => p.ratePlanId))];
  return rooms.length * plans.length === pairs.length;
}

/** Matches a search against a plan's name or code, and a room's name or code (§5.3 rule 7). */
export function matchesSearch(room: SelectableRoom, plan: SelectablePlan | null, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [room.name, room.code, plan?.name, plan?.code].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

/** A rate plan as the apps hold it: plan facts, plus which room types it is linked to. */
export interface LinkedPlan {
  id: string;
  name: string;
  code?: string | null;
  priceLogic: string;
  active?: boolean;
  parentName?: string | null;
  roomTypeIds: string[];
}

/**
 * Room types + linked plans → the tree.
 *
 * ⚠️ This is deliberately the ONE place the shape is built, because both bulk panels and the Mapping
 * screen have to agree about which plans belong to which room. When RevioLink and RevioCRS each
 * derived it themselves they disagreed: CM filtered inactive plans out of the picker entirely and
 * CRS did not, so the same property offered different plans on two screens.
 *
 * Every linked plan is included — `selectablePlans` decides what can be TICKED, and §5.3 rules 3
 * and 4 are explicit that a derived or inactive plan is shown greyed rather than dropped.
 */
export function buildSelectionTree(
  roomTypes: readonly { id: string; name: string; code?: string | null }[],
  plans: readonly LinkedPlan[],
): SelectableRoom[] {
  return roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    ...(rt.code ? { code: rt.code } : {}),
    plans: plans
      .filter((p) => p.roomTypeIds.includes(rt.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.code ? { code: p.code } : {}),
        active: p.active !== false,
        priceLogic: p.priceLogic,
        parentName: p.parentName ?? null,
      })),
  }));
}

/**
 * Which plans a price is written against, per room — the writer's half of the tree.
 *
 * ⚠️ This is where the rectangle is refused. `links` is what the property actually sells (the
 * `RatePlanRoomType` rows); `pairs` is what the person chose. The intersection is the only set that
 * is both real and intended:
 *
 * - a pair with no link is a combination the property does not sell — writing it creates a price
 *   row for a product that cannot be booked;
 * - a link with no pair is a combination nobody chose — this is the flattening bug, and it prices
 *   "2-Bedroom · BB Flex" because somebody ticked BB Flex on the Studio.
 *
 * `pairs` empty or absent means an older caller that only has axes; it then keeps every link, which
 * is the cross-product it already meant.
 */
export function plansPerRoom(
  links: readonly Pair[],
  pairs?: readonly Pair[] | null,
): Map<string, string[]> {
  const chosen = pairs && pairs.length > 0 ? new Set(pairs.map((p) => pairKey(p.roomTypeId, p.ratePlanId))) : null;
  const out = new Map<string, string[]>();
  for (const l of links) {
    if (chosen && !chosen.has(pairKey(l.roomTypeId, l.ratePlanId))) continue;
    out.set(l.roomTypeId, [...(out.get(l.roomTypeId) ?? []), l.ratePlanId]);
  }
  return out;
}
