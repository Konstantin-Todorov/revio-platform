/**
 * What to create on Channex to close a structure gap — decided before anything is sent.
 *
 * ## Why the decision is separated from the sending
 *
 * `structure-gap.ts` says a product never reached the channel. Repairing that means creating it on
 * Channex, and creating things on Channex is the one operation in this platform that cannot be
 * undone by us: a duplicate gets its own uuid, is silent, is permanent, and is **indistinguishable
 * from the real one afterwards** — you cannot tell by looking which of two identically-named
 * properties the OTAs were mapped against. `Ethno Villa Cherry` exists twice for exactly that reason.
 *
 * So the judgement lives here, as a pure function over what we hold and what Channex reports, and
 * the executor does only what this returns. It can be tested exhaustively without a network, and a
 * reviewer can read the decision without reading the HTTP.
 *
 * ## The rule that prevents the duplicate
 *
 * **Adopt before you create.** A product missing its mapping row does NOT mean Channex has never
 * heard of it — provisioning writes the room type and then the mapping, so a failure between the two
 * leaves the thing created and unmapped. Creating it again would be the duplicate. So anything whose
 * title already exists on Channex is *adopted*: we write the mapping to the id they already have.
 *
 * Matching is by trimmed, case-folded title, because that is the only handle we have. It is also why
 * `create` is the fallback and never the first move.
 */

export interface PlanRoomType {
  id: string;
  name: string;
  active: boolean;
  totalRooms: number;
  maxGuests: number;
}

export interface PlanRatePlan {
  id: string;
  name: string;
  active: boolean;
  priceLogic: string;
  /** Room types this plan sells on. Empty means all of them — "unscoped means everything". */
  roomTypeIds: readonly string[];
}

/** A product Channex already holds for this property. */
export interface ChannexExisting {
  id: string;
  title: string;
  /** Rate plans belong to one room type; room types have none. */
  roomTypeChannexId?: string | null;
}

export type StructureAction =
  | { kind: "adopt-room"; localId: string; name: string; channexId: string }
  | { kind: "create-room"; localId: string; name: string; totalRooms: number; maxGuests: number }
  | { kind: "adopt-rate"; localRoomId: string; localPlanId: string; label: string; channexId: string }
  | { kind: "create-rate"; localRoomId: string; localPlanId: string; label: string };

export interface StructurePlan {
  actions: StructureAction[];
  /** Named so a preview can say "nothing to do" rather than showing an empty list. */
  isEmpty: boolean;
}

const fold = (s: string) => s.trim().toLowerCase();

/** Does this plan sell on this room type? Naming none means all of them. */
export function planCoversRoom(plan: PlanRatePlan, roomTypeId: string): boolean {
  return plan.roomTypeIds.length === 0 || plan.roomTypeIds.includes(roomTypeId);
}

/**
 * Plan the repair.
 *
 * Only products that are **active** and, for rate plans, **manual** are considered — the same two
 * rules provisioning uses, because a plan Channex never holds cannot be missing from it.
 *
 * A rate plan is needed once per (room type × plan) PAIR: Channex ties a rate plan to exactly one
 * room type while we model plans at property level, so a hotel with three room types and one
 * "Standard Rate" needs three Channex rate plans. Sending one means the last write wins and two room
 * types are mispriced on every OTA — with everything green, because every call succeeded.
 */
export function planStructureSync(args: {
  roomTypes: readonly PlanRoomType[];
  ratePlans: readonly PlanRatePlan[];
  /** Local room type ids that already have a mapping row. */
  mappedRoomTypeIds: readonly string[];
  /** Already-mapped pairs, as `${roomTypeId}|${ratePlanId}`. */
  mappedPairKeys: readonly string[];
  /** What Channex reports for this property today. */
  channexRoomTypes: readonly ChannexExisting[];
  channexRatePlans: readonly ChannexExisting[];
}): StructurePlan {
  const mappedRooms = new Set(args.mappedRoomTypeIds);
  const mappedPairs = new Set(args.mappedPairKeys);
  const theirRoomsByTitle = new Map(args.channexRoomTypes.map((r) => [fold(r.title), r]));

  const actions: StructureAction[] = [];
  /** Local room id -> the Channex room id it will have, so rate plans can be attached to it. */
  const roomChannexId = new Map<string, string>();

  for (const rt of args.roomTypes) {
    if (!rt.active) continue;
    const theirs = theirRoomsByTitle.get(fold(rt.name));
    if (theirs) roomChannexId.set(rt.id, theirs.id);

    if (mappedRooms.has(rt.id)) continue;
    if (theirs) {
      actions.push({ kind: "adopt-room", localId: rt.id, name: rt.name, channexId: theirs.id });
    } else {
      actions.push({
        kind: "create-room", localId: rt.id, name: rt.name,
        totalRooms: rt.totalRooms, maxGuests: rt.maxGuests,
      });
    }
  }

  for (const rt of args.roomTypes) {
    if (!rt.active) continue;
    for (const rp of args.ratePlans) {
      if (!rp.active || rp.priceLogic !== "manual") continue;
      if (!planCoversRoom(rp, rt.id)) continue;
      if (mappedPairs.has(`${rt.id}|${rp.id}`)) continue;

      const label = `${rt.name} · ${rp.name}`;
      // Their rate plan titles repeat across room types, so a title alone is ambiguous — it only
      // identifies a plan together with the room type it hangs off.
      const theirRoom = roomChannexId.get(rt.id);
      const theirs = theirRoom
        ? args.channexRatePlans.find(
            (p) => fold(p.title) === fold(rp.name) && p.roomTypeChannexId === theirRoom,
          )
        : undefined;

      actions.push(
        theirs
          ? { kind: "adopt-rate", localRoomId: rt.id, localPlanId: rp.id, label, channexId: theirs.id }
          : { kind: "create-rate", localRoomId: rt.id, localPlanId: rp.id, label },
      );
    }
  }

  return { actions, isEmpty: actions.length === 0 };
}

/** What a preview says before anything is sent. Counts, because a list of forty is not a summary. */
export function describeStructurePlan(plan: StructurePlan): string {
  if (plan.isEmpty) return "Everything you sell is already on your channel manager. Nothing to send.";
  const n = (k: StructureAction["kind"]) => plan.actions.filter((a) => a.kind === k).length;
  const parts: string[] = [];
  const created = n("create-room") + n("create-rate");
  const adopted = n("adopt-room") + n("adopt-rate");
  if (created > 0) parts.push(`create ${created} product${created === 1 ? "" : "s"}`);
  if (adopted > 0) parts.push(`link ${adopted} that already exist${adopted === 1 ? "s" : ""} there`);
  return `This will ${parts.join(" and ")}.`;
}
