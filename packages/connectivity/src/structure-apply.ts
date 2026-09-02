import type { StructurePlan } from "./structure-plan.js";

/**
 * Sending a structure plan to Channex.
 *
 * `planStructureSync` decided what to do; this does it. The split is deliberate — the judgement
 * (adopt or create, one rate plan per pair) is pure and exhaustively tested, and what remains here
 * is the ordering, the persistence and the failure behaviour, which is what this file is about.
 *
 * ## Three rules, each learned from a real incident
 *
 * **1 — Write the mapping IMMEDIATELY after each create.** Provisioning used to persist everything
 * at the end, so any failure in between left products on Channex our database had never heard of,
 * and the next attempt created them again. That is how a property came to exist twice. The id
 * Channex returns is the one thing that cannot be recovered afterwards — two products with the same
 * title are indistinguishable — so it is written before the next call is made.
 *
 * **2 — One refusal must not abandon the rest.** A hotel with eight room types and one rate plan
 * Channex dislikes should end with seven room types working, not nothing. Failures are collected and
 * reported per item rather than thrown, because the alternative is a repair that gets less done the
 * more there is to repair.
 *
 * **3 — A room type that failed skips its own rate plans.** A Channex rate plan hangs off a room
 * type id. Attempting the plans of a room that was never created would either error confusingly or,
 * worse, attach them to the wrong room. Skipped and counted, so the report says why.
 */

/** The HTTP surface, injected so this is testable without a network. */
export type ChannexApi = (method: string, path: string, body?: unknown) => Promise<unknown>;

/**
 * The id Channex says it created.
 *
 * Narrowed rather than trusted: a response we cannot read must not become a mapping row pointing at
 * `undefined`. That would be a product we believe is connected and never reaches an OTA — the exact
 * shape of failure this whole area exists to remove.
 */
function createdId(res: unknown): string {
  const id = (res as { data?: { id?: unknown } } | null | undefined)?.data?.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("Channex accepted the request but returned no id, so nothing can be mapped to it.");
  }
  return id;
}

/** Only the two writers this needs — the same ones `ProvisionWrites` already defines. */
export interface StructureWrites {
  writeRoomMapping(channelId: string, tenantId: string, roomTypeId: string, externalRoomId: string): Promise<void>;
  writeRateMapping(
    channelId: string, tenantId: string, ratePlanId: string, roomTypeId: string, externalRateId: string,
  ): Promise<void>;
}

export interface StructureApplyContext {
  tenantId: string;
  channelId: string;
  channexPropertyId: string;
  currency: string;
  onStep?: (step: string, detail?: string) => void;
}

export interface StructureApplyOutcome {
  createdRooms: number;
  createdRates: number;
  adopted: number;
  /** Named, because "3 failed" sends somebody to read logs we could have quoted. */
  failures: { label: string; error: string }[];
  /** Rate plans not attempted because the room type they hang off never got an id. */
  skipped: { label: string; reason: string }[];
  ok: boolean;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function applyStructurePlan(
  plan: StructurePlan,
  ctx: StructureApplyContext,
  api: ChannexApi,
  writes: StructureWrites,
): Promise<StructureApplyOutcome> {
  const say = ctx.onStep ?? (() => {});
  const out: StructureApplyOutcome = {
    createdRooms: 0, createdRates: 0, adopted: 0, failures: [], skipped: [], ok: true,
  };

  /** Local room id -> Channex room id. Rate plans hang off this, so rooms are done first. */
  const roomIds = new Map<string, string>();
  /** Rooms we could not give an id to — their rate plans are skipped rather than misattached. */
  const roomFailed = new Set<string>();

  for (const a of plan.actions) {
    if (a.kind === "adopt-room") {
      try {
        await writes.writeRoomMapping(ctx.channelId, ctx.tenantId, a.localId, a.channexId);
        roomIds.set(a.localId, a.channexId);
        out.adopted++;
        say(`Linked room type “${a.name}”`, a.channexId);
      } catch (e) {
        roomFailed.add(a.localId);
        out.failures.push({ label: a.name, error: message(e) });
      }
    } else if (a.kind === "create-room") {
      try {
        const r = await api("POST", "/room_types", {
          room_type: {
            property_id: ctx.channexPropertyId,
            title: a.name,
            count_of_rooms: a.totalRooms,
            occ_adults: a.maxGuests,
            occ_children: 0,
            occ_infants: 0,
            default_occupancy: a.maxGuests,
          },
        });
        const theirs = createdId(r);
        // Rule 1: persisted before anything else can fail.
        await writes.writeRoomMapping(ctx.channelId, ctx.tenantId, a.localId, theirs);
        roomIds.set(a.localId, theirs);
        out.createdRooms++;
        say(`Created room type “${a.name}”`, theirs);
      } catch (e) {
        roomFailed.add(a.localId);
        out.failures.push({ label: a.name, error: message(e) });
      }
    }
  }

  for (const a of plan.actions) {
    if (a.kind !== "adopt-rate" && a.kind !== "create-rate") continue;

    // Rule 3.
    if (roomFailed.has(a.localRoomId)) {
      out.skipped.push({ label: a.label, reason: "its room type could not be sent" });
      continue;
    }

    if (a.kind === "adopt-rate") {
      try {
        await writes.writeRateMapping(ctx.channelId, ctx.tenantId, a.localPlanId, a.localRoomId, a.channexId);
        out.adopted++;
        say(`Linked rate plan “${a.label}”`, a.channexId);
      } catch (e) {
        out.failures.push({ label: a.label, error: message(e) });
      }
      continue;
    }

    const theirRoom = roomIds.get(a.localRoomId);
    if (!theirRoom) {
      // The room was already mapped, so the plan did not include an action for it. Its Channex id
      // lives in the mapping table the caller read; not having it here is a caller bug, not a hotel
      // one, and guessing an id would attach a price to the wrong room.
      out.skipped.push({ label: a.label, reason: "no channel id for its room type" });
      continue;
    }

    try {
      const p = await api("POST", "/rate_plans", {
        rate_plan: {
          title: a.label.split(" · ").slice(1).join(" · ") || a.label,
          property_id: ctx.channexPropertyId,
          room_type_id: theirRoom,
          currency: ctx.currency,
          sell_mode: "per_room",
          rate_mode: "manual",
          options: [{ occupancy: a.occupancy, is_primary: true, rate: 10000 }],
        },
      });
      const theirs = createdId(p);
      await writes.writeRateMapping(ctx.channelId, ctx.tenantId, a.localPlanId, a.localRoomId, theirs);
      out.createdRates++;
      say(`Created rate plan “${a.label}”`, theirs);
    } catch (e) {
      out.failures.push({ label: a.label, error: message(e) });
    }
  }

  out.ok = out.failures.length === 0 && out.skipped.length === 0;
  return out;
}

/** What the screen says afterwards. States failures plainly; a partial repair is not a success. */
export function describeStructureOutcome(o: StructureApplyOutcome): string {
  const done: string[] = [];
  const total = o.createdRooms + o.createdRates;
  if (total > 0) done.push(`created ${total}`);
  if (o.adopted > 0) done.push(`linked ${o.adopted}`);
  const head = done.length > 0 ? `Sent to your channel manager — ${done.join(", ")}.` : "Nothing was sent.";
  if (o.ok) return head;
  const bad: string[] = [];
  if (o.failures.length > 0) bad.push(`${o.failures.length} failed`);
  if (o.skipped.length > 0) bad.push(`${o.skipped.length} skipped`);
  return `${head} ${bad.join(" and ")} — these are still invisible to your OTAs.`;
}
