/**
 * Sending a room type or rate plan to Channex **after** the property was provisioned.
 *
 * ## The hole this fills
 *
 * `provisionChannexProperty` is one-shot (root `CLAUDE.md`): it sends what exists at the moment the
 * channel is connected, and there was no other code anywhere that creates a room type or rate plan
 * in Channex. So a hotel that adds a room next week has a room that no OTA can ever see, and no way
 * to change that from inside the product.
 *
 * `structureGap` already finds it and `describeStructureGap` already says it out loud — *"Deluxe
 * Suite has never reached your channel manager, so no OTA can see it"* — which left the hotel
 * reading an accurate description of a problem with no button beside it. That is the worst of both:
 * it looks like the software knows and has decided not to help.
 *
 * It matters most for exactly the people it was hardest for. A hotel we onboard by hand finishes
 * Rooms & Rates before anyone presses Connect. A hotel doing it themselves adds a room the week
 * after, because that is when they think of it.
 *
 * ## ⚠️ Read before you create
 *
 * Channex has no unique constraint on a title, so `POST /room_types` twice gives two rooms nobody
 * can tell apart — that is how one real property came to exist twice with our channel row pointing
 * at a third id. Provisioning learned it the expensive way; this refuses to relearn it. Every
 * create here is preceded by a read of what the property already holds, and a title that is already
 * there is **adopted, not duplicated**: we write the mapping to the existing id and report it as
 * adopted, so a half-finished earlier attempt heals instead of doubling.
 *
 * ## Mapping is written per step, never at the end
 *
 * Same reason as provisioning: an id we created and did not record is an orphan we cannot find
 * again. A room created and then a failing rate plan must still leave the room mapped.
 */

export class ChannexCatchupError extends Error {}

/**
 * A Channex response, typed only as far as this module actually reads it.
 *
 * `data` is an object for a create and an array for a listing, and everything below narrows before
 * touching it rather than asserting a shape we have not checked.
 */
export interface ChannexRow {
  id?: unknown;
  attributes?: Record<string, unknown>;
}
export interface ChannexResponse {
  data?: ChannexRow | ChannexRow[];
  errors?: unknown;
}

export interface CatchupApi {
  (method: string, path: string, body?: unknown): Promise<ChannexResponse>;
}

/** The id Channex returned for something it just created, or "" if it returned none. */
const createdId = (res: ChannexResponse): string => {
  const d = res?.data;
  return d && !Array.isArray(d) && d.id != null ? String(d.id) : "";
};

const listOf = (res: ChannexResponse): ChannexRow[] => (Array.isArray(res?.data) ? res.data : []);
const attr = (row: ChannexRow, key: string): string => {
  const v = row.attributes?.[key];
  return v == null ? "" : String(v);
};

/**
 * ⚠️ The api this module needs MUST throw on a non-2xx. Do not hand it a fetch that does not.
 *
 * An unauthenticated Channex request is `401` **with no `data` key**, so `Array.isArray(res.data)`
 * reads "this property has no room types" for a dead key exactly as it does for an empty property.
 * In a read-before-create that is not a wrong report, it is a WRITE: we would conclude the room is
 * missing and create a duplicate nobody can tell apart. This has caused three incidents already
 * (root `CLAUDE.md`), and this is the first place where the consequence is a duplicate rather than
 * a misleading number.
 *
 * So the status code is checked, never the array length, and the check lives here rather than in
 * each caller.
 */
export function channexApiFor(config: { apiKey: string; baseUrl: string }): CatchupApi {
  return async (method, path, body) => {
    const init: RequestInit = {
      method,
      headers: { "user-api-key": config.apiKey, "content-type": "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(`${config.baseUrl}${path}`, init);
    const text = await res.text();
    let json: ChannexResponse | null = null;
    try {
      json = text ? (JSON.parse(text) as ChannexResponse) : null;
    } catch {
      /* Channex returns HTML on some 5xx. */
    }
    const errors = json?.errors;
    if (!res.ok) {
      const details = errors && typeof errors === "object" ? (errors as { details?: unknown }).details : undefined;
      const detail =
        typeof errors === "string" ? errors
        : details !== undefined ? JSON.stringify(details)
        : text.slice(0, 300);
      throw new ChannexCatchupError(
        res.status === 401
          ? "Channex refused the API key. Nothing was sent — check the key in the Operator console under Connectivity."
          : `Channex refused ${method} ${path} (${res.status}): ${detail}`,
      );
    }
    return json ?? {};
  };
}

export interface CatchupRoomType {
  id: string;
  name: string;
  totalRooms: number;
  maxGuests: number;
}

export interface CatchupRatePlan {
  id: string;
  name: string;
  priceLogic: string;
  /** Empty means every room type — the platform's "unscoped means everything" convention. */
  roomTypeIds: string[];
}

export interface CatchupWrites {
  writeRoomMapping(roomTypeId: string, externalRoomId: string): Promise<void>;
  writeRateMapping(ratePlanId: string, roomTypeId: string, externalRateId: string): Promise<void>;
}

export interface CatchupStep {
  kind: "roomType" | "ratePlan";
  /** Our id. */
  id: string;
  name: string;
  externalId: string;
  /** True when the product already existed on Channex and we linked to it instead of creating one. */
  adopted: boolean;
}

export interface CatchupResult {
  steps: CatchupStep[];
  /** Products we deliberately did not send, and why — never a silent skip. */
  skipped: { name: string; why: string }[];
}

const PAGE = 100;
/** 50 pages is 5,000 products. A property past that is not a hotel, it is a fault. */
const MAX_PAGES = 50;

/**
 * ⚠️ Every page, or nothing — a truncated listing is how read-before-create becomes create-twice.
 *
 * The first version asked for `pagination[limit]=100` and stopped there. One Channex rate plan
 * belongs to ONE room type, so a property's plans multiply: ten rooms with ten plans is exactly a
 * hundred. Past that the listing silently loses rows, `existingRates` fails to find a plan that is
 * really there, and this module creates a second one — the precise duplicate it exists to refuse,
 * reintroduced by an unchecked default.
 *
 * So it pages until a short page ends it, and **throws rather than returning a partial list** if it
 * somehow runs past the cap. Returning what it has would be the silent truncation again, one order
 * of magnitude further out.
 */
async function allPages(api: CatchupApi, path: string, propertyId: string): Promise<ChannexRow[]> {
  const out: ChannexRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api(
      "GET",
      `${path}?filter[property_id]=${propertyId}&pagination[page]=${page}&pagination[limit]=${PAGE}`,
    );
    const rows = listOf(res);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
  throw new ChannexCatchupError(
    `Channex returned more than ${MAX_PAGES * PAGE} products for this property, which should not happen. ` +
      "Nothing was sent — sending against a partial listing would create duplicates.",
  );
}

/** Channex's own listing, reduced to what matching needs. */
async function existingRooms(api: CatchupApi, propertyId: string) {
  return (await allPages(api, "/room_types", propertyId)).map((r) => ({
    id: String(r.id),
    title: attr(r, "title"),
  }));
}

async function existingRates(api: CatchupApi, propertyId: string) {
  return (await allPages(api, "/rate_plans", propertyId)).map((r) => ({
    id: String(r.id),
    title: attr(r, "title"),
    roomTypeId: attr(r, "room_type_id") || null,
  }));
}

/** Titles are compared the way a person would read them, not byte for byte. */
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Send one room type — and every manual rate plan that sells it — to an existing Channex property.
 *
 * A room with no rate plan is a room that cannot take a booking, so the plans are not optional
 * extras here: sending the room alone would report success and leave the hotel exactly as unable to
 * sell it as before.
 */
export async function sendRoomTypeToChannex(args: {
  api: CatchupApi;
  channexPropertyId: string;
  currency: string;
  roomType: CatchupRoomType;
  /** Every rate plan the property has; the ones that sell this room are chosen here. */
  ratePlans: readonly CatchupRatePlan[];
  writes: CatchupWrites;
}): Promise<CatchupResult> {
  const { api, channexPropertyId, currency, roomType, ratePlans, writes } = args;
  const steps: CatchupStep[] = [];
  const skipped: { name: string; why: string }[] = [];

  const rooms = await existingRooms(api, channexPropertyId);
  const match = rooms.find((r) => same(r.title, roomType.name));

  let theirRoom: string;
  if (match) {
    theirRoom = match.id;
    steps.push({ kind: "roomType", id: roomType.id, name: roomType.name, externalId: theirRoom, adopted: true });
  } else {
    const created = await api("POST", "/room_types", {
      room_type: {
        property_id: channexPropertyId,
        title: roomType.name,
        count_of_rooms: roomType.totalRooms,
        occ_adults: roomType.maxGuests,
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: roomType.maxGuests,
      },
    });
    theirRoom = createdId(created);
    if (!theirRoom) throw new ChannexCatchupError("Channex accepted the room type but returned no id.");
    steps.push({ kind: "roomType", id: roomType.id, name: roomType.name, externalId: theirRoom, adopted: false });
  }
  // Written before the rate plans, so a plan Channex refuses cannot orphan the room.
  await writes.writeRoomMapping(roomType.id, theirRoom);

  const rates = await existingRates(api, channexPropertyId);
  const sellsThisRoom = ratePlans.filter(
    (rp) => rp.roomTypeIds.length === 0 || rp.roomTypeIds.includes(roomType.id),
  );

  for (const rp of sellsThisRoom) {
    if (rp.priceLogic !== "manual") {
      // Derived plans are computed from a parent on our side and never sent — Channex holds prices,
      // not the rule that produced them. Named rather than dropped.
      skipped.push({ name: rp.name, why: "derived — its price follows a parent plan here" });
      continue;
    }
    const existing = rates.find((r) => r.roomTypeId === theirRoom && same(r.title, rp.name));
    if (existing) {
      await writes.writeRateMapping(rp.id, roomType.id, existing.id);
      steps.push({ kind: "ratePlan", id: rp.id, name: rp.name, externalId: existing.id, adopted: true });
      continue;
    }
    const created = await api("POST", "/rate_plans", {
      rate_plan: {
        title: rp.name,
        property_id: channexPropertyId,
        room_type_id: theirRoom,
        currency,
        sell_mode: "per_room",
        rate_mode: "manual",
        options: [{ occupancy: roomType.maxGuests, is_primary: true, rate: 10000 }],
      },
    });
    const theirRate = createdId(created);
    if (!theirRate) throw new ChannexCatchupError(`Channex accepted the rate plan “${rp.name}” but returned no id.`);
    await writes.writeRateMapping(rp.id, roomType.id, theirRate);
    steps.push({ kind: "ratePlan", id: rp.id, name: rp.name, externalId: theirRate, adopted: false });
  }

  if (sellsThisRoom.every((rp) => rp.priceLogic !== "manual")) {
    throw new ChannexCatchupError(
      `“${roomType.name}” has no rate plan that sets its own prices, so Channex would hold a room nobody can book. ` +
        "Add a manual rate plan for it first.",
    );
  }

  return { steps, skipped };
}

/**
 * Send one rate plan to every room it sells that is already on Channex.
 *
 * ⚠️ One Channex rate plan belongs to exactly ONE room type, so a plan covering three rooms becomes
 * three rate plans there. That asymmetry is the root of BUG-019 and it is why this returns a step
 * per room rather than a single id.
 *
 * A room the plan sells that is NOT on Channex yet is reported as skipped, not created: the room is
 * the bigger object and creating it as a side effect of a rate-plan button would put a room on sale
 * that nobody asked to put on sale.
 */
export async function sendRatePlanToChannex(args: {
  api: CatchupApi;
  channexPropertyId: string;
  currency: string;
  ratePlan: CatchupRatePlan;
  /** Our room types, with the Channex id where one is already mapped. */
  rooms: readonly (CatchupRoomType & { externalRoomId: string | null })[];
  writes: CatchupWrites;
}): Promise<CatchupResult> {
  const { api, channexPropertyId, currency, ratePlan, rooms, writes } = args;

  if (ratePlan.priceLogic !== "manual") {
    throw new ChannexCatchupError(
      `“${ratePlan.name}” is derived from another plan, so its prices are computed here and never sent. ` +
        "Send the plan it comes from instead.",
    );
  }

  const steps: CatchupStep[] = [];
  const skipped: { name: string; why: string }[] = [];
  const targets = rooms.filter((r) => ratePlan.roomTypeIds.length === 0 || ratePlan.roomTypeIds.includes(r.id));
  if (targets.length === 0) {
    throw new ChannexCatchupError(`“${ratePlan.name}” is not linked to any room type, so there is nothing to send it for.`);
  }

  const rates = await existingRates(api, channexPropertyId);

  for (const room of targets) {
    if (!room.externalRoomId) {
      skipped.push({ name: room.name, why: "this room has not reached Channex yet — send the room first" });
      continue;
    }
    const existing = rates.find((r) => r.roomTypeId === room.externalRoomId && same(r.title, ratePlan.name));
    if (existing) {
      await writes.writeRateMapping(ratePlan.id, room.id, existing.id);
      steps.push({ kind: "ratePlan", id: ratePlan.id, name: `${ratePlan.name} · ${room.name}`, externalId: existing.id, adopted: true });
      continue;
    }
    const created = await api("POST", "/rate_plans", {
      rate_plan: {
        title: ratePlan.name,
        property_id: channexPropertyId,
        room_type_id: room.externalRoomId,
        currency,
        sell_mode: "per_room",
        rate_mode: "manual",
        options: [{ occupancy: room.maxGuests, is_primary: true, rate: 10000 }],
      },
    });
    const theirRate = createdId(created);
    if (!theirRate) throw new ChannexCatchupError(`Channex accepted “${ratePlan.name}” for ${room.name} but returned no id.`);
    await writes.writeRateMapping(ratePlan.id, room.id, theirRate);
    steps.push({ kind: "ratePlan", id: ratePlan.id, name: `${ratePlan.name} · ${room.name}`, externalId: theirRate, adopted: false });
  }

  if (steps.length === 0) {
    throw new ChannexCatchupError(
      `Nothing was sent: every room “${ratePlan.name}” sells is still missing from Channex. Send those rooms first.`,
    );
  }

  return { steps, skipped };
}

/** What the hotel reads afterwards — created, adopted and skipped kept apart, because they differ. */
export function describeCatchup(r: CatchupResult): string {
  const made = r.steps.filter((s) => !s.adopted).length;
  const adopted = r.steps.filter((s) => s.adopted).length;
  const parts: string[] = [];
  if (made > 0) parts.push(`${made} sent to your channel manager`);
  // Adopted is not the same as created and must never be reported as it: it means the product was
  // already there and we linked to it, which is the answer to "why is there no new room".
  if (adopted > 0) parts.push(`${adopted} already existed and ${adopted === 1 ? "was" : "were"} linked`);
  if (r.skipped.length > 0) parts.push(`${r.skipped.length} skipped (${r.skipped.map((s) => `${s.name}: ${s.why}`).join("; ")})`);
  return parts.length > 0 ? `${parts.join(" · ")}.` : "Nothing to send.";
}
