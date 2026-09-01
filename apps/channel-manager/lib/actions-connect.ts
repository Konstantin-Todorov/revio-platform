"use server";

import { revalidatePath } from "next/cache";
import {
  CHANNEL_CODES,
  visibleFields,
  defaultSettings,
  missingRequired,
  channexApiConfig,
  fetchChannelAdapter,
  testChannelConnection,
  createChannexChannel,
  provisionChannexProperty,
  type ChannelField,
} from "@revio/connectivity";
import { prisma } from "./db";
import { getProperty } from "./data";
import { guard } from "./authz";

/**
 * Connecting a real OTA, from RevioLink, without anyone opening the Channex dashboard.
 *
 * The existing `addChannel` stays where it is and is a different thing: it creates a **mock** channel
 * with fabricated external ids so the demo has something to push at. This one creates a channel that
 * actually reaches Booking.com.
 *
 * ## Why the form is not written here
 *
 * Channex describes its own connection form — `GET /channels/adapter?code=` returns field names,
 * types, labels, defaults and dropdown options — so this file renders whatever that says rather than
 * carrying a per-OTA form we would have to maintain. A channel Channex adds next year works with no
 * deploy from us. `channex-channels.ts` holds the parsing and its tests.
 *
 * It also keeps the form HONEST about how little is asked. Booking.com's descriptor has exactly one
 * visible field — the hotel's own Hotel ID. Everything else on it (machine account, payout
 * permissions, VCC flags) is `hidden`, and a hand-written form would have invited us to ask for
 * things Channex fills in itself.
 */

export type FormResult =
  | { ok: true; fields: ChannelField[]; defaults: Record<string, unknown>; title: string }
  | { ok: false; error: string };

/** Fetch the form for one channel. Called when the person picks a channel from the list. */
export async function loadChannelForm(code: string): Promise<FormResult> {
  const g = await guard("manageDistribution");
  if (!g.ok) return { ok: false, error: g.error };

  const property = await getProperty();
  const mode = await modeFor(property.id);
  if (!mode) {
    return {
      ok: false,
      error:
        "This property is not connected to Channex yet. It needs a Channex property before a channel can be added.",
    };
  }

  const cfg = await channexApiConfig(property.tenantId, mode);
  const descriptor = await fetchChannelAdapter(cfg, code);
  if (!descriptor) return { ok: false, error: `Channex does not recognise the channel code "${code}".` };

  return {
    ok: true,
    fields: visibleFields(descriptor),
    defaults: defaultSettings(descriptor),
    title: descriptor.title,
  };
}

export type ConnectResult = { ok: true; channelId: string } | { ok: false; error: string };

/**
 * Test, then create — **inactive**.
 *
 * The test is not optional politeness. A channel created against credentials that do not work looks
 * connected in our UI and pushes nothing, which is the failure mode this platform keeps finding: a
 * green Sync Center over a hotel that is not on sale.
 *
 * Created switched off because activating is when inventory reaches the OTA and when Channex starts
 * billing us for the property. That belongs to its own click on a screen that says so.
 */
export async function connectChannel(_prev: ConnectResult | null, fd: FormData): Promise<ConnectResult> {
  const g = await guard("manageDistribution");
  if (!g.ok) return { ok: false, error: g.error };

  const code = String(fd.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Pick a channel." };
  const known = CHANNEL_CODES.find((c) => c.code === code);
  if (!known) return { ok: false, error: `Unknown channel code "${code}".` };

  const property = await getProperty();
  const mode = await modeFor(property.id);
  if (!mode) return { ok: false, error: "This property is not connected to Channex yet." };

  const externalPropertyId = await channexPropertyId(property.id);
  if (!externalPropertyId) return { ok: false, error: "This property has no Channex property id." };

  const exists = await prisma.channel.findFirst({ where: { propertyId: property.id, code } });
  if (exists) return { ok: false, error: `${known.name} is already connected.` };

  const cfg = await channexApiConfig(property.tenantId, mode);
  const descriptor = await fetchChannelAdapter(cfg, code);
  if (!descriptor) return { ok: false, error: `Channex does not recognise "${code}".` };

  // Start from the descriptor's own defaults so hidden and unedited fields keep the values Channex
  // expects, then overlay only what the person actually typed.
  const settings: Record<string, unknown> = { ...defaultSettings(descriptor) };
  for (const field of visibleFields(descriptor)) {
    const raw = fd.get(`settings.${field.name}`);
    if (field.type === "boolean") {
      // An unchecked box is ABSENT from FormData, not false. Reading `null` as "leave the default"
      // would make a box that defaults to true impossible to turn off.
      settings[field.name] = raw !== null;
      continue;
    }
    if (raw === null) continue;
    settings[field.name] = String(raw);
  }

  // Respects the conditional rules, so a field Channex would hide is not demanded. Returns the
  // hotel's own labels ("Hotel ID"), which is what the message should say.
  const missing = missingRequired(descriptor, settings);
  if (missing.length > 0) return { ok: false, error: `Still needed: ${missing.join(", ")}.` };

  const test = await testChannelConnection(cfg, code, externalPropertyId, settings);
  if (!test.ok) {
    return {
      ok: false,
      // The most likely cause by far, and the one the hotel can act on — so it is said first, before
      // the API's own message.
      error:
        `${known.name} did not accept these details. The usual cause is that the hotel has not yet ` +
        `authorised us in their ${known.name} extranet. — ${test.message}`,
    };
  }

  const created = await createChannexChannel(cfg, {
    code,
    title: `${property.name} · ${known.name}`,
    propertyId: externalPropertyId,
    settings,
  });

  const channel = await prisma.channel.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      code,
      name: known.name,
      // Not "connected": nothing is on sale until it is activated, and a status that says otherwise
      // is the lie this whole flow is built to avoid.
      status: "pending",
      currency: property.baseCurrency,
      connectivityMode: mode,
      externalPropertyId,
      externalChannelId: created.id,
      supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "advance_purchase_min"],
    },
    select: { id: true },
  });

  revalidatePath("/channels");
  return { ok: true, channelId: channel.id };
}

/**
 * Which Channex environment this property lives in — read from a channel that already exists rather
 * than assumed, so a sandbox property can never have a production channel bolted onto it.
 */
async function modeFor(propertyId: string): Promise<string | null> {
  const existing = await prisma.channel.findFirst({
    where: { propertyId, connectivityMode: { in: ["channex_prod", "channex_sandbox"] } },
    select: { connectivityMode: true },
  });
  return existing?.connectivityMode ?? null;
}

async function channexPropertyId(propertyId: string): Promise<string | null> {
  const existing = await prisma.channel.findFirst({
    where: { propertyId, externalPropertyId: { not: null } },
    select: { externalPropertyId: true },
  });
  return existing?.externalPropertyId ?? null;
}

export type ProvisionOutcome = { ok: true; rooms: number; rates: number } | { ok: false; error: string };

/**
 * Put this property onto Channex — the step that used to require somebody at Revio running a script.
 *
 * A hotel finished its own onboarding, reached "Connect a channel", and could go no further. Worse,
 * the Channels page did not say so: with no Channex property it offered the MOCK dialog, so a real
 * hotel could create a fabricated channel, see it marked connected, and believe it was selling.
 *
 * Safe to click and safe to click twice:
 *
 *  - **Refuses a demo tenant.** A production adapter must never point at demo data, and this is the
 *    same rule `factory.ts` and the CLI enforce.
 *  - **Refuses if already provisioned**, rather than creating a second Channex property that would
 *    be billed and would take half the pushes.
 *  - **Costs nothing.** Channex bills per property with an ACTIVE CHANNEL. This creates the property,
 *    its rooms and its rates; no channel is connected and no meter starts. The screen says so.
 */
export async function provisionChannex(): Promise<ProvisionOutcome> {
  const g = await guard("manageDistribution");
  if (!g.ok) return { ok: false, error: g.error };

  const property = await getProperty();

  const tenant = await prisma.tenant.findUnique({
    where: { id: property.tenantId },
    select: { name: true, isDemo: true, hasChannelManager: true },
  });
  if (!tenant) return { ok: false, error: "Could not read this hotel." };
  if (tenant.isDemo) {
    return {
      ok: false,
      error: "This is a demo hotel. A real Channex property must never point at demo data.",
    };
  }
  if (!tenant.hasChannelManager) {
    return { ok: false, error: "RevioLink is not enabled for this hotel." };
  }

  const already = await prisma.channel.findFirst({
    where: { propertyId: property.id, externalPropertyId: { not: null } },
    select: { id: true },
  });
  /*
   * Already connected — and since the channel row is now written the INSTANT Channex returns the
   * property id, this also catches a run that stopped part-way. So the message cannot just say "no":
   * a half-provisioned hotel needs to be told where to finish, not sent back to a button that
   * refuses. Provisioning again would create a duplicate property, which is the thing being avoided.
   */
  if (already) {
    return {
      ok: false,
      error: "This property is already on Channex. If setup stopped part-way, finish it in Mapping — " +
        "running setup again would create a second property in Channex that nobody can tell apart.",
    };
  }

  const [roomTypes, ratePlans] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: property.id, active: true },
      select: { id: true, name: true, totalRooms: true, maxGuests: true },
      orderBy: { name: "asc" },
    }),
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      select: { id: true, name: true, priceLogic: true, roomTypeLinks: { select: { roomTypeId: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Production unless the deployment says otherwise. A hotel clicking this in the real product means
  // the real thing; the sandbox is reached by the CLI, where rehearsing is the explicit intent.
  const mode = process.env.CHANNEX_MODE === "sandbox" ? "channex_sandbox" : "channex_prod";
  const cfg = await channexApiConfig(property.tenantId, mode);

  try {
    const result = await provisionChannexProperty(
      {
        tenantId: property.tenantId,
        tenantName: tenant.name,
        property: {
          id: property.id,
          name: property.name,
          baseCurrency: property.baseCurrency,
          timezone: property.timezone,
          address: property.address ?? null,
          contactEmail: property.contactEmail ?? null,
          phone: property.phone ?? null,
        },
        roomTypes,
        ratePlans: ratePlans.map((r) => ({
          id: r.id,
          name: r.name,
          priceLogic: r.priceLogic,
          roomTypeIds: r.roomTypeLinks.map((l) => l.roomTypeId),
        })),
        mode,
        apiKey: cfg.apiKey,
      },
      {
        writeChannel: async (i) => {
          const existing = await prisma.channel.findFirst({
            where: { propertyId: i.propertyId, code: "channex" },
            select: { id: true },
          });
          return existing
            ? prisma.channel.update({
                where: { id: existing.id },
                data: { connectivityMode: i.mode, externalPropertyId: i.channexPropertyId, status: "connected" },
                select: { id: true },
              })
            : prisma.channel.create({
                data: {
                  tenantId: i.tenantId, propertyId: i.propertyId, name: "Channex", code: "channex",
                  connectivityMode: i.mode, externalPropertyId: i.channexPropertyId,
                  status: "connected", currency: i.currency,
                },
                select: { id: true },
              });
        },
        writeRoomMapping: async (channelId, tenantId, roomTypeId, externalRoomId) => {
          await prisma.channelRoomTypeMapping.upsert({
            where: { channelId_roomTypeId: { channelId, roomTypeId } },
            create: { tenantId, channelId, roomTypeId, externalRoomId, status: "complete" },
            update: { externalRoomId, status: "complete" },
          });
        },
        writeRateMapping: async (channelId, tenantId, ratePlanId, roomTypeId, externalRateId) => {
          await prisma.channelRatePlanMapping.upsert({
            where: { channelId_ratePlanId_roomTypeId: { channelId, ratePlanId, roomTypeId } },
            create: { tenantId, channelId, ratePlanId, roomTypeId, externalRateId, status: "complete" },
            update: { externalRateId, status: "complete" },
          });
        },
      },
    );

    revalidatePath("/channels");
    return { ok: true, rooms: result.roomMap.length, rates: result.rateMap.length };
  } catch (e) {
    // ChannexProvisionError messages are written for a hotelier and name the fix; anything else is
    // reported as-is rather than flattened into "something went wrong".
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
