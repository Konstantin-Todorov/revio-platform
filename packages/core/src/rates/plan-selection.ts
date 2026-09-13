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
  if (options.length === 0) return "unchecked";
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
  for (const r of rooms) for (const p of selectablePlans(r)) next.add(pairKey(r.id, p.id));
  return next;
}

export function invertSelection(rooms: readonly SelectableRoom[], selected: ReadonlySet<string>): Set<string> {
  const next = new Set<string>();
  for (const r of rooms) {
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
  }
  return out;
}

/** "Selected 2 rate plans across 1 room type" — §5.3 rule 8. */
export function selectionCount(groups: readonly SelectionGroup[]): string {
  const plans = groups.reduce((s, g) => s + g.plans.length, 0);
  if (plans === 0) return "Nothing selected";
  return `Selected ${plans} rate plan${plans === 1 ? "" : "s"} across ${groups.length} room type${groups.length === 1 ? "" : "s"}`;
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
