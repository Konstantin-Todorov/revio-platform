

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

import { CHANNEX_PROD_URL, CHANNEX_SANDBOX_URL } from "@revio/core";

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
  /**
   * Validate and report without creating anything.
   *
   * Every refusal still runs — including the GET that checks whether Channex already holds a
   * property with this title, which is the one check worth having before a real run. Only the
   * writes are skipped: no POST, no channel row, no mappings.
   *
   * The runbook says "always --dry-run first", so this is a documented safety feature rather than a
   * convenience, and it lives here rather than in the caller precisely so both paths get it.
   */
  dryRun?: boolean;
}

export interface ProvisionResult {
  channexPropertyId: string;
  roomMap: { ours: string; theirs: string; name: string }[];
  rateMap: { ourRoom: string; ourPlan: string; theirs: string; label: string }[];
}

/** Anything the caller must persist. Kept out of this function so it stays testable and DB-free. */
export interface ProvisionWrites {
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
  channex_prod: CHANNEX_PROD_URL,
  channex_sandbox: CHANNEX_SANDBOX_URL,
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

  const dry = input.dryRun === true;

  const api = async (method: string, path: string, body?: unknown): Promise<any> => {
    // Reads still happen on a dry run — the duplicate-title check is the point of rehearsing.
    if (dry && method !== "GET") return { data: { id: `DRY-RUN-${path.replace(/\W+/g, "")}` } };
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

  /*
   * 1 — DELIBERATELY NOT STORING THE KEY. This step used to read:
   *
   *     await writes.upsertCredential(input.tenantId, mode, encryptSecret(apiKey));
   *
   * which took whatever key this run authenticated with — normally the PLATFORM key, since we are
   * the Channex customer and hotels do not have accounts — and froze a per-tenant copy of it.
   *
   * That copy then OVERRIDES the platform key for that tenant forever, because the lookup reads the
   * per-tenant row first. Rotate the platform key and every previously-provisioned hotel silently
   * keeps the old dead one. Verified on the first real hotel 2026-09-01: its "own key" was
   * byte-identical to the platform key, nobody had pasted it, and the console showed it as a
   * per-client credential as though somebody had chosen it.
   *
   * The key already exists wherever it belongs. Copying it created a second, staler source of truth
   * and bought nothing. A hotel that genuinely brings its own Channex account still gets a row —
   * entered deliberately in Operator → Connectivity, where it is tested before it is stored.
   */

  /*
   * 2a — REFUSE TO CREATE A SECOND PROPERTY WITH THE SAME NAME.
   *
   * Channex is happy to hold ten properties called "Ethno Villa Cherry" and gives each a fresh uuid,
   * so a duplicate is silent, permanent, and indistinguishable from the real one afterwards — you
   * cannot tell by looking which of two identically-named properties the OTAs were mapped against.
   *
   * Cheap to prevent, expensive to undo, and it costs one GET. Checked against the account this key
   * can actually see, which is also a free check that the key works before we start writing.
   */
  const existing = await api("GET", "/properties");
  const clash = (existing?.data ?? []).find(
    (x: { id: string; attributes?: { title?: string } }) =>
      (x.attributes?.title ?? "").trim().toLowerCase() === property.name.trim().toLowerCase(),
  );
  if (clash) {
    throw new ChannexProvisionError(
      `Channex already has a property called “${property.name}” (${clash.id}). ` +
      "Provisioning again would create a second one that nobody can tell apart. " +
      "If that property is this hotel, connect it instead; if it is an orphan from a failed run, delete it in Channex first.",
    );
  }

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

  /*
   * ⚠️ PERSIST THE ID **NOW**, before anything else can fail.
   *
   * This write used to happen at the very END, after every room type and rate plan. So any failure
   * in between — a rate plan Channex refused, a timeout, a closed laptop — left a property sitting
   * in Channex that our database had never heard of. And the "already connected?" guard reads our
   * database, so the next attempt saw nothing, created ANOTHER property, and orphaned the first.
   *
   * That is how `Ethno Villa Cherry` came to exist twice in Channex (`3987f78c…`, `7eb14a83…`) while
   * our channel row pointed at a third id that no longer exists at all. The founder guessed the
   * cause before the code was read.
   *
   * The id is the one thing that cannot be recreated or looked up reliably afterwards — two
   * properties with the same title are indistinguishable. Everything after this point is repairable
   * from our own data; this is not. So it is written first, and a partial failure now leaves a
   * visible, fixable channel row instead of an invisible orphan.
   */
  const channel = dry
    ? { id: "DRY-RUN-CHANNEL" }
    : await writes.writeChannel({
        tenantId: input.tenantId,
        propertyId: property.id,
        mode,
        channexPropertyId,
        currency: property.baseCurrency,
      });

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

  // 5 — the mapping tables. The Channel row itself was written the moment Channex returned the
  //     property id, so a failure above leaves a repairable record rather than an orphan.
  if (!dry) {
    for (const m of roomMap) await writes.writeRoomMapping(channel.id, input.tenantId, m.ours, m.theirs);
    for (const m of rateMap) {
      await writes.writeRateMapping(channel.id, input.tenantId, m.ourPlan, m.ourRoom, m.theirs);
    }
  }
  say("Mapped every room and rate", `${roomMap.length} rooms · ${rateMap.length} rates`);

  return { channexPropertyId, roomMap, rateMap };
}
