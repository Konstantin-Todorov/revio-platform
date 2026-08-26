import { encryptSecret } from "@revio/db";

/**
 * Putting a hotel onto Channex — from the product, not from a terminal.
 *
 * ## Why this exists
 *
 * This logic lived only in `scripts/channex-onboard.ts`, which meant a hotel finished its own
 * onboarding, reached "Connect a channel", and hit a wall only somebody at Revio could get past. The
 * screen did not say so, either: with no Channex property, the Channels page silently offered the
 * MOCK dialog, so a real hotel could create a fabricated channel, see it marked connected, and
 * believe it was selling. That is the exact failure this platform keeps closing everywhere else.
 *
 * So the work moved here, behind an interface both the CLI and a server action can call. The script
 * stays — it is how we rehearse against the sandbox and how a bulk onboarding gets done — but it is
 * no longer the only way in.
 *
 * ## What it does, in Channex's order
 *
 *   1. store the API key for this tenant, encrypted
 *   2. create the property
 *   3. create a room type per room type
 *   4. create a rate plan per (room type × manual plan) PAIR — see below
 *   5. write our Channel row and both mapping tables
 *
 * **Step 4 is the one that has already caused a real bug.** Channex ties a rate plan to exactly one
 * room type; we model plans at property level. A hotel with three room types and one "Standard Rate"
 * needs THREE Channex rate plans. Sending one means the last write wins and two room types are
 * mispriced on every OTA — with a green Sync Center, because every call succeeded.
 *
 * Derived plans are skipped deliberately: they follow their parent locally, and Channex only needs
 * the plans we actually author.
 */

export interface ProvisionProperty {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
  address: string | null;
  contactEmail: string | null;
  phone: string | null;
}

export interface ProvisionRoomType {
  id: string;
  name: string;
  totalRooms: number;
  maxGuests: number;
}

export interface ProvisionRatePlan {
  id: string;
  name: string;
  priceLogic: string;
  roomTypeIds: string[];
}

export interface ProvisionInput {
  tenantId: string;
  tenantName: string;
  property: ProvisionProperty;
  roomTypes: ProvisionRoomType[];
  ratePlans: ProvisionRatePlan[];
  /** `channex_prod` or `channex_sandbox`. Decides the host as well as which key is meaningful. */
  mode: string;
  apiKey: string;
  /** Called with each step as it completes, so a CLI can log and a screen can show progress. */
  onStep?: (step: string, detail?: string) => void;
}

export interface ProvisionResult {
  channexPropertyId: string;
  roomMap: { ours: string; theirs: string; name: string }[];
  rateMap: { ourRoom: string; ourPlan: string; theirs: string; label: string }[];
}

/** Anything the caller must persist. Kept out of this function so it stays testable and DB-free. */
export interface ProvisionWrites {
  upsertCredential(tenantId: string, mode: string, cipher: string): Promise<void>;
  writeChannel(input: {
    tenantId: string;
    propertyId: string;
    mode: string;
    channexPropertyId: string;
    currency: string;
  }): Promise<{ id: string }>;
  writeRoomMapping(channelId: string, tenantId: string, roomTypeId: string, externalRoomId: string): Promise<void>;
  writeRateMapping(
    channelId: string,
    tenantId: string,
    ratePlanId: string,
    roomTypeId: string,
    externalRateId: string,
  ): Promise<void>;
}

const HOSTS: Record<string, string> = {
  channex_prod: "https://app.channex.io/api/v1",
  channex_sandbox: "https://staging.channex.io/api/v1",
};

/**
 * Details Channex demands and a hotel may not have filled in.
 *
 * Ours, not invented — we are the connectivity provider of record for these properties, and a
 * fabricated hotel address would be worse than a real one that is ours. The hotel's own values win
 * whenever they exist.
 */
const FALLBACK = {
  email: "office@reviosoft.app",
  phone: "+359894306704",
  country: "BG",
  state: "Ruse",
  city: "Ruse",
  zip: "7002",
  address: "—",
};

export class ChannexProvisionError extends Error {}

export async function provisionChannexProperty(
  input: ProvisionInput,
  writes: ProvisionWrites,
): Promise<ProvisionResult> {
  const { property, roomTypes, ratePlans, mode, apiKey } = input;
  const say = input.onStep ?? (() => {});

  if (!apiKey.trim()) {
    throw new ChannexProvisionError(
      "No Channex API key is configured. Add it in the Operator console under Connectivity.",
    );
  }
  if (roomTypes.length === 0) {
    throw new ChannexProvisionError("Add your room types before connecting a channel — Channex needs them first.");
  }
  if (ratePlans.length === 0) {
    throw new ChannexProvisionError("Add at least one rate plan before connecting a channel.");
  }
  if (!ratePlans.some((r) => r.priceLogic === "manual")) {
    // Every plan derived from a parent that does not exist on Channex would create a property with
    // rooms and no sellable rate — a state that looks provisioned and cannot take a booking.
    throw new ChannexProvisionError(
      "Every rate plan here is derived from another. At least one plan must set its own prices before this hotel can be put on Channex.",
    );
  }

  const base = HOSTS[mode];
  if (!base) throw new ChannexProvisionError(`Unknown connectivity mode "${mode}".`);

  const api = async (method: string, path: string, body?: unknown): Promise<any> => {
    const init: RequestInit = {
      method,
      headers: { "user-api-key": apiKey, "content-type": "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* Channex returns HTML on some 5xx. */
    }
    if (!res.ok) {
      const detail =
        typeof json?.errors === "string"
          ? json.errors
          : json?.errors?.details
            ? JSON.stringify(json.errors.details)
            : text.slice(0, 300);
      throw new ChannexProvisionError(`Channex refused ${method} ${path} (${res.status}): ${detail}`);
    }
    return json;
  };

  // 1 — the key, encrypted, on the same path the Operator console writes.
  await writes.upsertCredential(input.tenantId, mode, encryptSecret(apiKey));
  say("Stored the Channex key");

  // 2 — the property.
  const created = await api("POST", "/properties", {
    property: {
      title: property.name,
      currency: property.baseCurrency,
      email: property.contactEmail || FALLBACK.email,
      phone: property.phone || FALLBACK.phone,
      country: FALLBACK.country,
      state: FALLBACK.state,
      city: FALLBACK.city,
      address: property.address || FALLBACK.address,
      zip_code: FALLBACK.zip,
      timezone: property.timezone,
      property_type: "hotel",
    },
  });
  const channexPropertyId: string = created.data.id;
  say("Created the property on Channex", channexPropertyId);

  // 3 + 4 — room types, then a rate plan per (room type × manual plan) pair.
  const roomMap: ProvisionResult["roomMap"] = [];
  const rateMap: ProvisionResult["rateMap"] = [];

  for (const rt of roomTypes) {
    const r = await api("POST", "/room_types", {
      room_type: {
        property_id: channexPropertyId,
        title: rt.name,
        count_of_rooms: rt.totalRooms,
        occ_adults: rt.maxGuests,
        occ_children: 0,
        occ_infants: 0,
        default_occupancy: rt.maxGuests,
      },
    });
    const theirRoom: string = r.data.id;
    roomMap.push({ ours: rt.id, theirs: theirRoom, name: rt.name });
    say(`Room type “${rt.name}”`, `${rt.totalRooms} rooms`);

    for (const rp of ratePlans) {
      if (rp.priceLogic !== "manual") continue;
      // A plan naming room types applies only to those; naming none means all of them — the same
      // "unscoped means everything" convention used across the platform.
      if (rp.roomTypeIds.length > 0 && !rp.roomTypeIds.includes(rt.id)) continue;
      const p = await api("POST", "/rate_plans", {
        rate_plan: {
          title: rp.name,
          property_id: channexPropertyId,
          room_type_id: theirRoom,
          currency: property.baseCurrency,
          sell_mode: "per_room",
          rate_mode: "manual",
          options: [{ occupancy: rt.maxGuests, is_primary: true, rate: 10000 }],
        },
      });
      rateMap.push({ ourRoom: rt.id, ourPlan: rp.id, theirs: p.data.id, label: `${rt.name} · ${rp.name}` });
      say(`  Rate plan “${rp.name}”`, rt.name);
    }
  }

  // 5 — our Channel row and both mapping tables.
  const channel = await writes.writeChannel({
    tenantId: input.tenantId,
    propertyId: property.id,
    mode,
    channexPropertyId,
    currency: property.baseCurrency,
  });
  for (const m of roomMap) await writes.writeRoomMapping(channel.id, input.tenantId, m.ours, m.theirs);
  for (const m of rateMap) {
    await writes.writeRateMapping(channel.id, input.tenantId, m.ourPlan, m.ourRoom, m.theirs);
  }
  say("Mapped every room and rate", `${roomMap.length} rooms · ${rateMap.length} rates`);

  return { channexPropertyId, roomMap, rateMap };
}
