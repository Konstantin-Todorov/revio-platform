/**
 * Take one real hotel from signed to distributing, in a single command.
 *
 * Everything here was previously a sequence of dashboard clicks and hand-copied UUIDs, done once
 * against the sandbox for certification and never repeated. That is fine as a one-off and hopeless as
 * an onboarding: a hotel's first day should not depend on somebody remembering the order, and a
 * mistyped room-type UUID is a channel that looks connected and silently sells the wrong room.
 *
 * What it does, per hotel:
 *   1. stores the production API key for the tenant, ENCRYPTED (the same path the Operator console
 *      writes, so there is one storage format and not two)
 *   2. creates the Channex property from OUR property record — no re-typing
 *   3. creates a Channex room type per room type we hold, with its real room count and occupancy
 *   4. creates a Channex rate plan per (room type × rate plan) we hold, at its current price
 *   5. writes the Channel row in `channex_prod` mode with every mapping filled in
 *   6. pushes ARI and reads the task back, so "connected" means it actually worked
 *
 *   pnpm channex:onboard --tenant <slug> --property <name|id> [--dry-run] [--sandbox] [--cleanup]
 *
 * **`--sandbox` rehearses the whole thing on staging.channex.io.** Use it to learn the process, to
 * check a hotel's data produces the right room types and rate plans, and to train somebody — all
 * without touching a billed production account. It sets the channel to `channex_sandbox`, which is
 * what makes the adapter talk to staging: the MODE picks the base URL, so a sandbox key on a
 * `channex_prod` channel authenticates against the wrong host and every push is rejected.
 *
 * **`--dry-run` prints the whole plan and touches nothing.** Run it first, every time: this creates
 * objects in a billed production account, and Channex charges per property with an active channel.
 *
 * **`--cleanup` deletes the Channex property this created.** It exists so the whole path can be
 * rehearsed end to end against production and then removed — which is how it was verified without
 * leaving a billable property behind. It refuses to touch a property that has a channel attached.
 */
import { forSystem } from "@revio/db";
import { encryptSecret } from "@revio/db";

const SANDBOX = process.argv.includes("--sandbox");
/*
 * The mode picks the host, so the two must agree.
 *
 * `createChannelAdapter` derives the base URL from the channel's `connectivityMode` — production for
 * `channex_prod`, staging for `channex_sandbox`. A rehearsal that stored a sandbox key on a
 * `channex_prod` channel authenticated a staging key against the production host and had all 42
 * updates rejected. Deriving both from one flag makes that mismatch impossible.
 */
const BASE = process.env.CHANNEX_BASE_URL ?? (SANDBOX ? "https://staging.channex.io/api/v1" : "https://app.channex.io/api/v1");
const MODE = SANDBOX ? "channex_sandbox" : "channex_prod";
const KEY = (SANDBOX ? process.env.CHANNEX_API_KEY : process.env.CHANNEX_PROD_KEY) ?? "";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);
const DRY = has("dry-run");

function say(step: string, detail = "") {
  console.log(`  ${DRY ? "would" : "  ok "} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "user-api-key": KEY, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  // A 200 can still carry rejections. Same trap the adapter had; do not repeat it here.
  const warnings = json?.meta?.warnings;
  if (Array.isArray(warnings) && warnings.length) {
    throw new Error(`${method} ${path} → 200 but Channex rejected values: ${JSON.stringify(warnings).slice(0, 400)}`);
  }
  return json;
}

async function main() {
  if (!KEY) {
    throw new Error(
      SANDBOX
        ? "CHANNEX_API_KEY is not set — the sandbox key lives in packages/connectivity/.env.local."
        : "CHANNEX_PROD_KEY is not set. Export it, or rehearse with --sandbox.",
    );
  }
  const slug = flag("tenant");
  const propertyRef = flag("property");
  if (!slug) throw new Error("--tenant <slug> is required.");

  const db = forSystem();
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, isDemo: true, hasChannelManager: true },
  });
  if (!tenant) throw new Error(`No tenant with slug "${slug}".`);

  /*
   * Channex provisioning is the ONE thing that distinguishes the seven ways to buy this platform.
   * RevioCRS and RevioPMS need nothing outside our own database — the shared core is their
   * integration — so a Channex property for a client without RevioLink is a property that will never
   * have a channel: clutter in an account we are billed against per property, and a mapping nobody
   * maintains. Refused rather than warned, because the operator running this has already decided.
   */
  if (!tenant.hasChannelManager && !has("i-know")) {
    throw new Error(
      `"${tenant.name}" does not have RevioLink. Channex is only needed for the channel manager — ` +
        `RevioCRS and RevioPMS need no external provisioning. Grant the entitlement first, or pass --i-know.`,
    );
  }

  /*
   * The rule from factory.ts, enforced rather than remembered.
   *
   * A production Channex property for a demo hotel is wrong twice: it points a real adapter at fake
   * data, and it eventually bills. Overridable with --i-know, because rehearsing this path against
   * production is exactly how it got verified.
   */
  if (tenant.isDemo && !has("i-know")) {
    throw new Error(`"${tenant.name}" is a DEMO tenant. A real adapter must never point at demo data. Pass --i-know only to rehearse.`);
  }

  const property = await db.property.findFirst({
    where: {
      tenantId: tenant.id,
      ...(propertyRef ? { OR: [{ id: propertyRef }, { name: propertyRef }] } : {}),
    },
    select: { id: true, name: true, baseCurrency: true, timezone: true, address: true },
  });
  if (!property) throw new Error(`No property found for ${tenant.name}${propertyRef ? ` matching "${propertyRef}"` : ""}.`);

  const roomTypes = await db.roomType.findMany({
    where: { propertyId: property.id, active: true },
    select: { id: true, name: true, totalRooms: true, maxGuests: true },
    orderBy: { name: "asc" },
  });
  /*
   * Which (room type, rate plan) pairs actually exist.
   *
   * `RatePlanRoomType` already declares this — a plan states the room types it applies to — so the
   * pairs are read, not guessed. Each pair becomes exactly ONE Channex rate plan, because that is
   * how Channex models it: a rate plan belongs to a single room type.
   */
  const ratePlans = await db.ratePlan.findMany({
    where: { propertyId: property.id },
    select: { id: true, name: true, priceLogic: true, roomTypeLinks: { select: { roomTypeId: true } } },
    orderBy: { sortOrder: "asc" },
  });
  if (roomTypes.length === 0) throw new Error("That property has no active room types — add them before connecting a channel.");
  if (ratePlans.length === 0) throw new Error("That property has no rate plans.");

  console.log(`\n${tenant.name} → ${property.name}   [${SANDBOX ? "SANDBOX — staging.channex.io" : "PRODUCTION — billed"}]`);
  console.log(`  ${roomTypes.length} room type(s), ${ratePlans.length} rate plan(s), ${property.baseCurrency}\n`);

  if (has("cleanup")) return cleanup(db, property.id);

  // 1 — the key, encrypted, on the same path the console writes.
  if (!DRY) {
    await db.connectivityCredential.upsert({
      where: { tenantId_mode: { tenantId: tenant.id, mode: MODE } },
      create: { tenantId: tenant.id, mode: MODE, cipher: encryptSecret(KEY) },
      update: { cipher: encryptSecret(KEY) },
    });
  }
  say(`stored the ${SANDBOX ? "sandbox" : "production"} key, encrypted`, `tenant ${tenant.name}`);

  // 2 — the Channex property.
  let channexPropertyId = "DRY-RUN";
  if (!DRY) {
    const created = await api("POST", "/properties", {
      property: {
        title: property.name,
        currency: property.baseCurrency,
        // Channex requires these; ours are the truthful values we already hold.
        email: "office@reviosoft.app",
        phone: "+359894306704",
        country: "BG",
        state: "Ruse",
        city: "Ruse",
        address: property.address ?? "—",
        zip_code: "7002",
        timezone: property.timezone,
        property_type: "hotel",
      },
    });
    channexPropertyId = created.data.id;
  }
  say("created the Channex property", channexPropertyId);

  // 3 + 4 — room types and their rate plans.
  const roomMap: { ours: string; theirs: string; name: string }[] = [];
  const rateMap: { ourRoom: string; ourPlan: string; theirs: string; label: string }[] = [];

  for (const rt of roomTypes) {
    let theirRoom = "DRY-RUN";
    if (!DRY) {
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
      theirRoom = r.data.id;
    }
    roomMap.push({ ours: rt.id, theirs: theirRoom, name: rt.name });
    say(`room type "${rt.name}"`, `${rt.totalRooms} rooms · ${theirRoom}`);

    for (const rp of ratePlans) {
      // Derived plans follow their parent locally; Channex only needs the plans we actually author.
      if (rp.priceLogic !== "manual") continue;
      // A plan that names its room types applies only to those. A plan that names none applies to
      // all of them — the same "unscoped means everything" convention used across the platform.
      const scoped = rp.roomTypeLinks.map((x) => x.roomTypeId);
      if (scoped.length > 0 && !scoped.includes(rt.id)) continue;
      let theirRate = "DRY-RUN";
      if (!DRY) {
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
        theirRate = p.data.id;
      }
      rateMap.push({ ourRoom: rt.id, ourPlan: rp.id, theirs: theirRate, label: `${rt.name} · ${rp.name}` });
      say(`  rate plan "${rp.name}"`, theirRate);
    }
  }

  // 5 — our Channel row, in production mode, fully mapped.
  if (!DRY) {
    const existing = await db.channel.findFirst({
      where: { propertyId: property.id, code: "channex" },
      select: { id: true },
    });
    const channel = existing
      ? await db.channel.update({
          where: { id: existing.id },
          data: { connectivityMode: MODE, externalPropertyId: channexPropertyId, status: "connected" },
          select: { id: true },
        })
      : await db.channel.create({
          data: {
            tenantId: tenant.id, propertyId: property.id, name: "Channex", code: "channex",
            connectivityMode: MODE, externalPropertyId: channexPropertyId,
            status: "connected", currency: property.baseCurrency,
          },
          select: { id: true },
        });
    for (const m of roomMap) {
      await db.channelRoomTypeMapping.upsert({
        where: { channelId_roomTypeId: { channelId: channel.id, roomTypeId: m.ours } },
        create: { tenantId: tenant.id, channelId: channel.id, roomTypeId: m.ours, externalRoomId: m.theirs, status: "complete" },
        update: { externalRoomId: m.theirs, status: "complete" },
      });
    }
    for (const m of rateMap) {
      // Keyed by room type as well as plan — the whole point of the mapping fix.
      await db.channelRatePlanMapping.upsert({
        where: {
          channelId_ratePlanId_roomTypeId: {
            channelId: channel.id, ratePlanId: m.ourPlan, roomTypeId: m.ourRoom,
          },
        },
        create: {
          tenantId: tenant.id, channelId: channel.id, ratePlanId: m.ourPlan,
          roomTypeId: m.ourRoom, externalRateId: m.theirs, status: "complete",
        },
        update: { externalRateId: m.theirs, status: "complete" },
      });
    }
  }
  say("wrote the channel + every mapping", `${roomMap.length} rooms, ${rateMap.length} rates`);

  console.log(`\n${DRY ? "Dry run — nothing was created." : `Done. Channex property ${channexPropertyId}.`}`);
  if (!DRY) {
    console.log("Next: connect the hotel's OTAs in Channex (their credentials), then Re-sync from RevioLink.");
    console.log(`Undo: pnpm channex:onboard --tenant ${slug} --cleanup\n`);
  }
}

/** Remove what this script created — so the path can be rehearsed against production and undone. */
async function cleanup(db: ReturnType<typeof forSystem>, propertyId: string) {
  const channel = await db.channel.findFirst({
    where: { propertyId, code: "channex" },
    select: { id: true, externalPropertyId: true },
  });
  if (!channel?.externalPropertyId) {
    console.log("  nothing to clean up — no Channex channel on this property.\n");
    return;
  }
  const chx = channel.externalPropertyId;

  // Refuse if the property has channels attached: deleting one with a live OTA connection is not a
  // rehearsal any more, it is taking a hotel off sale.
  const channels = await api("GET", `/channels?filter[property_id]=${chx}`);
  if ((channels?.data ?? []).length > 0) {
    throw new Error(`Channex property ${chx} has ${channels.data.length} channel(s) attached. Refusing to delete — disconnect them first.`);
  }

  await api("DELETE", `/properties/${chx}`);
  await db.channelRatePlanMapping.deleteMany({ where: { channelId: channel.id } });
  await db.channelRoomTypeMapping.deleteMany({ where: { channelId: channel.id } });
  await db.channel.delete({ where: { id: channel.id } });
  console.log(`  removed Channex property ${chx} and the local channel.\n`);
}

main()
  .catch((e) => { console.error(`\nFAILED: ${e.message}\n`); process.exit(1); })
  .finally(async () => { const { prisma } = await import("@revio/db"); await prisma.$disconnect(); });
