"use server";
import { withTenantTransaction } from "@revio/db";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { pullChannel, reimportChannelBookings as sharedReimport, fullSyncChannel, pauseChannel, resumeChannel, disconnectChannel, reconnectChannel } from "./connectivity";
import { sendEmail } from "@revio/email";
import { deliverNewBookings } from "./booking-delivery";
import type { PushField, PushScope } from "@revio/connectivity";
import { logAudit, recordPush, str, int, strList, utcDay } from "./mutation-helpers";
import { flashError, setFlash } from "@revio/ui/flash";
import { guard, requireCapability } from "./authz";
import { earliestSelectable, renderSystemEmail, renderSystemEmailText, todayInTimeZone } from "@revio/core";
import { sortPriceFindings, verifyPublished, verifyPublishedAvailability, verifyPublishedRestrictions } from "@revio/connectivity";
import { i18n } from "./i18n/server";
import { rateErrors } from "./i18n/rate-errors";
import { channelErrors } from "./i18n/channel-errors";
import { settings as settingsDict } from "./i18n/settings";

/** The refusal words, in the reader's language — see `lib/i18n/channel-errors.ts`. */
async function sayCh() {
  return (await i18n()).t(channelErrors);
}

export type ActionResult = { ok: boolean; error?: string };

const BOOL_TYPES = new Set(["stop_sell", "cta", "ctd"]);

/** A rule changes exactly one restriction, so its push may carry exactly one field. */
const RULE_TYPE_TO_PUSH: Record<string, PushField> = {
  min_los: "minStay", max_los: "maxStay", stop_sell: "stopSell", cta: "cta", ctd: "ctd",
};

const RULE_DAY_MS = 86_400_000;

/** The scope a restriction rule pushes with: its own dates, its own products, its own one field. */
function ruleScope(rule: {
  type: string; roomTypeId: string | null; ratePlanId: string | null; dateFrom: Date; dateTo: Date;
}): PushScope {
  const dates: string[] = [];
  for (let t = rule.dateFrom.getTime(); t <= rule.dateTo.getTime(); t += RULE_DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  const field = RULE_TYPE_TO_PUSH[rule.type];
  return {
    dates,
    // A null room type or rate plan means "all of them" — leave the axis unnarrowed rather than
    // narrowing it to an empty list, which now means "nothing".
    ...(rule.roomTypeId ? { roomTypeIds: [rule.roomTypeId] } : {}),
    ...(rule.ratePlanId ? { ratePlanIds: [rule.ratePlanId] } : {}),
    // advance_purchase has no Channex equivalent and is filtered out downstream; an unmapped type
    // falls back to a full field set rather than pushing nothing at all.
    ...(field ? { fields: [field] } : {}),
  };
}

// --- Restriction rules -----------------------------------------------------

export async function saveRestrictionRule(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageRates");
  if (!_g.ok) return { ok: false, error: _g.error };
  const { id: propertyId, tenantId, timezone } = await getProperty();
  const rowId = str(fd, "id");
  const name = str(fd, "name");
  const type = str(fd, "type");
  const { t, day } = await i18n();
  const e = t(rateErrors);
  if (!name) return { ok: false, error: e.nameRequired };
  if (!type) return { ok: false, error: e.pickType };

  const dateFrom = str(fd, "dateFrom");
  const dateTo = str(fd, "dateTo");
  if (!dateFrom || !dateTo) return { ok: false, error: e.pickRange };

  /*
   * ⚠️ A restriction governs inventory that has NOT happened yet, so it cannot start in the past.
   *
   * The `min` on the two date fields stops people trying; this stops it happening. `min` is a hint
   * to a picker — it survives neither a typed value in every browser nor a replayed post — and a
   * rule written into last week does nothing except push a restriction for a gone date to
   * Booking.com, which we then cannot explain.
   *
   * Editing an EXISTING rule keeps its own start as the floor: a rule that already began in the
   * past is a fact, and being unable to change its value because time passed would be worse.
   */
  const existing = rowId
    ? await prisma.restrictionRule.findFirst({ where: { id: rowId, tenantId }, select: { dateFrom: true } })
    : null;
  const earliest = earliestSelectable(
    todayInTimeZone(timezone),
    existing ? existing.dateFrom.toISOString().slice(0, 10) : null,
  );
  // Core's `pastRangeRefusal`, worded for the reader.
  if (dateFrom < earliest) return { ok: false, error: e.past(e.startDate, day(dateFrom), day(earliest)) };
  if (dateTo < earliest) return { ok: false, error: e.past(e.endDate, day(dateTo), day(earliest)) };

  const channelCodes = strList(fd, "channelCodes");
  const roomTypeId = str(fd, "roomTypeId") || null;
  const ratePlanId = str(fd, "ratePlanId") || null;
  const isBool = BOOL_TYPES.has(type);
  const valueInt = isBool ? null : Math.max(0, int(fd, "value"));
  const valueBool = isBool ? true : null;
  const priority = int(fd, "priority", 0);
  const active = fd.get("active") != null;

  const data = {
    tenantId, propertyId, name, type, roomTypeId, ratePlanId, channelCodes,
    dateFrom: utcDay(dateFrom), dateTo: utcDay(dateTo), valueInt, valueBool, priority, active,
  };

  if (rowId) {
    await prisma.restrictionRule.update({ where: { id: rowId }, data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "edit", newValue: type, source: "rule" });
  } else {
    await prisma.restrictionRule.create({ data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "create", newValue: type, source: "rule" });
  }
  await recordPush(propertyId, tenantId, `Restriction rule "${name}" pushed`, ruleScope(data));
  revalidatePath("/bulk-update");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteRestrictionRule(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const rule = await prisma.restrictionRule.findUnique({ where: { id } });
  if (!rule) return;
  await prisma.restrictionRule.delete({ where: { id } });
  await logAudit(propertyId, tenantId, { entity: `Restriction · ${rule.name}`, field: "delete", source: "rule" });
  // Deleting a rule used to push nothing, so the channel kept enforcing a minimum stay the hotel had
  // just removed. The dates it covered have to be re-sent for the next tier down to take effect.
  await recordPush(propertyId, tenantId, `Restriction rule "${rule.name}" removed`, ruleScope(rule));
  revalidatePath("/bulk-update");
  revalidatePath("/calendar");
}

// --- Mapping ---------------------------------------------------------------

export async function fixMappings(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return;

  /*
   * ⚠️ MOCK CHANNELS ONLY. This function fabricates ids.
   *
   * It fills a blank mapping with a deterministic string — `channex-rp-BB48` — which is exactly
   * right for a mock adapter that reads its own invented ids back, and catastrophic for a real one:
   * no such rate plan exists in Channex, so every push for that plan afterwards targets nothing.
   * The hotel sees "1 unmapped fixed" and green everywhere.
   *
   * Reported as BUG-021 on 13 Sept ("Auto-fix would very likely bind it to an arbitrary Channex
   * id"). It is worse than arbitrary — it is guaranteed not to exist. A real channel's ids can only
   * come from Channex, so the honest answer is to refuse and say where they come from.
   */
  if (channel.connectivityMode !== "mock") {
    return flashError((await sayCh()).realChannelNoAutofix(channel.name));
  }

  // Fill any unmapped room types and rate plans with a deterministic mock external id.
  const [rooms, rates] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId, status: { not: "complete" } }, include: { roomType: true } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId, status: { not: "complete" } }, include: { ratePlan: true } }),
  ]);
  for (const m of rooms) {
    await prisma.channelRoomTypeMapping.update({ where: { id: m.id }, data: { status: "complete", externalRoomId: m.externalRoomId ?? `${channel.code}-r-${m.roomType.code}` } });
  }
  for (const m of rates) {
    await prisma.channelRatePlanMapping.update({ where: { id: m.id }, data: { status: "complete", externalRateId: m.externalRateId ?? `${channel.code}-rp-${m.ratePlan.code}` } });
  }
  const fixed = rooms.length + rates.length;
  await prisma.channel.update({ where: { id: channelId }, data: { errorCount: { set: Math.max(0, channel.errorCount - 1) } } });
  await logAudit(propertyId, tenantId, { entity: `Mapping · ${channel.name}`, field: "fix", newValue: `${fixed} mappings completed` });
  await recordPush(propertyId, tenantId, `Mapping completed for ${channel.name} (${fixed})`);
  revalidatePath("/mapping");
  revalidatePath("/channels");
  revalidatePath("/dashboard");
}

/** Manually set one stream mapping's external id (kind: "room" → room type, "rate" → rate plan). */
/**
 * Create the mapping row for a product that provisioning never sent.
 *
 * The channel is resolved from the property rather than trusted from the form — the form carries it
 * only as a hint, and a mapping written against another hotel's channel would be a cross-tenant
 * write. Everything is scoped to the caller's own property.
 */
async function createMappingRow(
  kind: "room" | "rate",
  args: {
    tenantId: string; propertyId: string; productId: string; channelId: string | null;
    externalId: string | null; status: string;
    /**
     * ⚠️ Which room type this rate mapping is FOR. Rate plans only.
     *
     * Channex holds one rate plan per room type; Revio holds one per property. A row written
     * without this is a catch-all that applies to EVERY room, so all three room types' prices
     * funnel into whichever single Channex plan it names — which is exactly how a €666 price set
     * on the 1-Bedroom was published against the 2-Bedroom on 13 September, silently.
     *
     * Null is still permitted, because mock channels legitimately use catch-alls and every
     * pre-existing row is one. It is the SCREEN's job never to write a new one for a real channel.
     */
    roomTypeId?: string | null;
  },
): Promise<{ ok: true; channelName: string; productName: string } | { ok: false; error: string }> {
  if (!args.productId) return { ok: false, error: (await sayCh()).mapping.rowNotLinked };

  const channel = args.channelId
    ? await prisma.channel.findFirst({ where: { id: args.channelId, propertyId: args.propertyId } })
    : await prisma.channel.findFirst({ where: { propertyId: args.propertyId, status: "connected" }, orderBy: { name: "asc" } });
  if (!channel) return { ok: false, error: (await sayCh()).mapping.noChannel };

  if (kind === "room") {
    const rt = await prisma.roomType.findFirst({ where: { id: args.productId, propertyId: args.propertyId } });
    if (!rt) return { ok: false, error: (await sayCh()).mapping.roomGone };
    await prisma.channelRoomTypeMapping.create({
      data: {
        tenantId: args.tenantId, channelId: channel.id, roomTypeId: rt.id,
        externalRoomId: args.externalId, status: args.status,
      },
    });
    return { ok: true, channelName: channel.name, productName: rt.name };
  }

  const rp = await prisma.ratePlan.findFirst({ where: { id: args.productId, propertyId: args.propertyId } });
  if (!rp) return { ok: false, error: (await sayCh()).mapping.planGone };

  // Verified against this property, never trusted from the form — a mapping written against another
  // hotel's room type would be a cross-tenant write.
  let roomTypeId: string | null = null;
  if (args.roomTypeId) {
    const rt = await prisma.roomType.findFirst({ where: { id: args.roomTypeId, propertyId: args.propertyId } });
    if (!rt) return { ok: false, error: (await sayCh()).mapping.roomGone };
    roomTypeId = rt.id;
  }

  await prisma.channelRatePlanMapping.create({
    data: {
      tenantId: args.tenantId, channelId: channel.id, ratePlanId: rp.id,
      ...(roomTypeId ? { roomTypeId } : {}),
      externalRateId: args.externalId, status: args.status,
    },
  });
  const productName = roomTypeId
    ? `${(await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId }, select: { name: true } })).name} · ${rp.name}`
    : rp.name;
  return { ok: true, channelName: channel.name, productName };
}

export async function updateStreamMapping(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageDistribution");
  if (!_g.ok) return { ok: false, error: _g.error };
  const { id: propertyId, tenantId } = await getProperty();
  const kind = str(fd, "kind");
  const id = str(fd, "id");
  // Dropdown selection, or a hand-typed id when the OTA product isn't in the pulled list.
  const externalId = str(fd, "externalIdCustom") || str(fd, "externalId") || null;
  const status = externalId ? "complete" : "incomplete";
  /*
   * ⚠️ Which room this rate mapping is for. Absent on the room stream and on mock channels.
   *
   * Without it every rate row is a catch-all covering all room types, which is BUG-019: a price set
   * on one room publishes against another, silently. The screen sends one row per (room, plan).
   */
  const mappingRoomTypeId = str(fd, "mappingRoomTypeId") || null;

  /*
   * ⚠️ A product with no mapping row is MAPPED, not refused.
   *
   * `provisionChannexProperty` creates these rows once, from whatever existed when the channel was
   * connected — so every room type and rate plan added afterwards has no row, and this action used
   * to answer "Mapping not found." for products the hotel could see on screen. That is one half of
   * why a hotel could not map its third room type or either of its live rate plans (BUG-010/011).
   */
  const productId = str(fd, "productId");
  const channelId = str(fd, "channelId") || null;

  if (kind === "room") {
    const m = id
      ? await prisma.channelRoomTypeMapping.findUnique({ where: { id }, include: { channel: true, roomType: true } })
      : null;
    if (id && (!m || m.tenantId !== tenantId)) return { ok: false, error: (await sayCh()).mapping.notFound };

    if (m) {
      await prisma.channelRoomTypeMapping.update({ where: { id: m.id }, data: { externalRoomId: externalId, status } });
      await logAudit(propertyId, tenantId, { entity: `Mapping · ${m.channel.name} · ${m.roomType.name}`, field: "room mapping", newValue: status });
    } else {
      const created = await createMappingRow("room", { tenantId, propertyId, productId, channelId, externalId, status });
      if (!created.ok) return created;
      await logAudit(propertyId, tenantId, { entity: `Mapping · ${created.channelName} · ${created.productName}`, field: "room mapping", newValue: status });
    }
  } else {
    const m = id
      ? await prisma.channelRatePlanMapping.findUnique({ where: { id }, include: { channel: true, ratePlan: true } })
      : null;
    if (id && (!m || m.tenantId !== tenantId)) return { ok: false, error: (await sayCh()).mapping.notFound };

    if (m) {
      await prisma.channelRatePlanMapping.update({ where: { id: m.id }, data: { externalRateId: externalId, status } });
      await logAudit(propertyId, tenantId, { entity: `Mapping · ${m.channel.name} · ${m.ratePlan.name}`, field: "rate mapping", newValue: status });
    } else {
      const created = await createMappingRow("rate", {
        tenantId, propertyId, productId, channelId, externalId, status,
        ...(mappingRoomTypeId ? { roomTypeId: mappingRoomTypeId } : {}),
      });
      if (!created.ok) return created;
      await logAudit(propertyId, tenantId, { entity: `Mapping · ${created.channelName} · ${created.productName}`, field: "rate mapping", newValue: status });
    }
  }
  await recordPush(propertyId, tenantId, "Mapping updated");
  revalidatePath("/mapping");
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Channel settings & add channel ---------------------------------------

export async function saveChannelSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageDistribution");
  if (!_g.ok) return { ok: false, error: _g.error };
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  const id = str(fd, "id");
  // Channels inherit the property currency — there is no per-channel currency setting.
  const currency = property.baseCurrency;
  const conversionType = str(fd, "conversionType") || "none";
  const markupPct = Number(str(fd, "markupPct")) || 0;
  const commissionPct = Number(str(fd, "commissionPct")) || 0;
  const rounding = str(fd, "rounding") || "none";
  const connectivityMode = str(fd, "connectivityMode") || "mock";
  const externalPropertyId = str(fd, "externalPropertyId") || null;

  const ch = await prisma.channel.findUnique({ where: { id } });
  if (!ch) return { ok: false, error: (await sayCh()).unknownChannel };
  await prisma.channel.update({ where: { id }, data: { currency, conversionType, markupPct, commissionPct, rounding, connectivityMode, externalPropertyId } });
  await logAudit(propertyId, tenantId, { entity: `Channel · ${ch.name}`, field: "settings", newValue: `${markupPct}% markup` });
  await recordPush(propertyId, tenantId, `Channel settings updated for ${ch.name}`);
  revalidatePath("/channels");
  return { ok: true };
}

const KNOWN_OTAS: Record<string, string> = {
  booking: "Booking.com", expedia: "Expedia", trip: "Trip.com", agoda: "Agoda",
  airbnb: "Airbnb", hotelbeds: "Hotelbeds", hrs: "HRS", webbeds: "WebBeds",
};

export async function addChannel(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageDistribution");
  if (!_g.ok) return { ok: false, error: _g.error };
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  const code = str(fd, "code");
  const name = (KNOWN_OTAS[code] ?? str(fd, "name")) || code;
  const currency = property.baseCurrency; // inherit the property currency
  const externalPropertyId = str(fd, "externalPropertyId") || null;
  if (!code) return { ok: false, error: (await sayCh()).pickChannel };

  const exists = await prisma.channel.findFirst({ where: { propertyId, code } });
  if (exists) return { ok: false, error: (await sayCh()).alreadyConnected(name) };

  // Map every room type and rate plan to the new channel (two streams) so it's immediately sellable.
  const [roomTypes, ratePlans] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId } }),
    prisma.ratePlan.findMany({ where: { propertyId } }),
  ]);
  // One transaction: a channel committed without its mappings reads "connected" and sells nothing.
  await withTenantTransaction(tenantId, async (tx) => {
    const channel = await tx.channel.create({
      data: {
        tenantId, propertyId, code, name, status: "connected", currency, externalPropertyId,
        supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "advance_purchase_min"],
        lastSyncAt: new Date(), errorCount: 0, pendingCount: 0,
      },
    });
    await tx.channelRoomTypeMapping.createMany({
      data: roomTypes.map((rt) => ({ tenantId, channelId: channel.id, roomTypeId: rt.id, externalRoomId: `${code}-r-${rt.code}`, status: "complete" })),
    });
    await tx.channelRatePlanMapping.createMany({
      data: ratePlans.map((rp) => ({ tenantId, channelId: channel.id, ratePlanId: rp.id, externalRateId: `${code}-rp-${rp.code}`, status: "complete" })),
    });
  });
  await logAudit(propertyId, tenantId, { entity: `Channel · ${name}`, field: "connect", newValue: `${roomTypes.length} rooms + ${ratePlans.length} rates mapped` });
  await recordPush(propertyId, tenantId, `Connected ${name} and pushed all products`);
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Manual Sync (spec §3.5): a full recovery push over the property's whole sync horizon — forces a
 * drifted channel back into agreement with the shared ARI, through the same queue/batching as every
 * other push. This is the only push that deliberately carries everything. */
export async function resyncChannel(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const outcome = await fullSyncChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "full_sync",
    newValue: `${outcome.pushed} pushed · ${outcome.rejected} rejected (${outcome.mode}, full horizon)`,
    channelCode: ch?.code,
  });
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/sync");
  revalidatePath("/dashboard");
}

function revalidateChannels() {
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/dashboard");
  /*
   * Y2 — drop the CLIENT router cache for EVERY route under this layout, not just the ones named
   * above.
   *
   * Reported as "other pages are blocked and do not work, sometimes you have to reload". The cause
   * is Next's client-side Router Cache: a page you have already visited is served from memory on the
   * next navigation, and `revalidatePath("/calendar")` only clears the entry it names. So a change
   * made on one screen left every OTHER screen showing the value from before it — and screens no
   * action mentioned at all (RevioLink's /bulk-update and /users, RevioCRS's /reports, RevioPMS's
   * /settings and /walkin) were never cleared by anything.
   *
   * The named paths above stay, because they document what this mutation actually touches. This one
   * line is the safety net: `"layout"` clears the whole subtree, so no screen can be left behind by
   * an action that forgot to list it.
   */
}

/** Pause (spec §3.5): reversible stop-sell overlay on one channel; the core ARI is untouched. */
export async function pauseChannelAction(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const out = await pauseChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "pause",
    newValue: out.ok ? "paused — all dates closed (reversible)" : `failed: ${out.error}`,
    channelCode: ch?.code,
  });
  revalidateChannels();
  // Said on the screen, not only in the audit log. The channel reads "paused" either way — that is
  // deliberate — so without this a hotel that pressed it during an incident sees the button work
  // while the OTA goes on selling.
  if (!out.ok) return flashError(out.error ?? (await sayCh()).notConfirmed);
}

export async function resumeChannelAction(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const out = await resumeChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "resume",
    newValue: out.ok ? "resumed — prior state restored from shared ARI" : `failed: ${out.error}`,
    channelCode: ch?.code,
  });
  revalidateChannels();
}

/** Disconnect (spec §3.5): close out + stop syncing; mapping kept dormant; reservations untouched. */
export async function disconnectChannelAction(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const out = await disconnectChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "disconnect",
    newValue: out.ok ? "disconnected — mapping dormant, imported reservations untouched" : `failed: ${out.error}`,
    channelCode: ch?.code,
  });
  revalidateChannels();
  // Said on the screen, not only in the audit log. The channel reads "disconnectd" either way — that is
  // deliberate — so without this a hotel that pressed it during an incident sees the button work
  // while the OTA goes on selling.
  if (!out.ok) return flashError(out.error ?? (await sayCh()).notConfirmed);
}

export async function reconnectChannelAction(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const out = await reconnectChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "reconnect",
    newValue: out.ok ? "reconnected — dormant mapping reused, full sync pushed" : `failed: ${out.error}`,
    channelCode: ch?.code,
  });
  revalidateChannels();
}

/**
 * Re-import bookings the feed can no longer offer.
 *
 * ⚠️ Use this after fixing a mapping. A booking that arrived before the room and rate were mapped
 * was recorded as `failed_import` **and acknowledged to Channex**, so the revisions feed will never
 * send it again — an ordinary Pull cannot bring it back and Re-sync only pushes. This re-fetches the
 * last few days from the channel's bookings endpoint, and the normal import path upgrades the
 * `failed_import` rows in place once their products resolve.
 *
 * Reported by the founder on 2026-09-12: a live Booking.com reservation sat in Channex and reached
 * no Revio product, with nothing on any screen to explain it or to retry it.
 */
export async function reimportChannelBookings(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return flashError((await sayCh()).reimport.choose);

  const outcome = await sharedReimport(channelId);
  await logAudit(propertyId, tenantId, {
    entity: "Channel sync", field: "reimport",
    newValue: outcome.ok
      ? `${outcome.imported} new · ${outcome.updated} updated · ${outcome.failedImport} still unmapped`
      : `failed: ${outcome.error ?? "unknown"}`,
    source: "api",
  });
  revalidatePath("/sync");
  revalidatePath("/reservations");

  const ri = (await sayCh()).reimport;
  if (!outcome.ok) {
    return flashError(ri.failed(outcome.error ?? ri.noAnswer));
  }
  if (outcome.failedImport > 0) {
    return setFlash("info", ri.stillUnmapped(outcome.imported + outcome.updated, outcome.failedImport));
  }
  return setFlash(
    "success",
    outcome.imported + outcome.updated === 0 ? ri.nothingNew : ri.brought(outcome.imported, outcome.updated),
  );
}

/** Pull bookings from the channel now (new → imported, cancelled → restored, unmapped → Error Center). */
export async function pullChannelBookings(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const outcome = await pullChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: "Channel sync", field: "pull",
    newValue: outcome.ok ? `${outcome.imported} new · ${outcome.updated} updated (${outcome.mode})` : `failed: ${outcome.error ?? "unknown"}`,
    source: "api",
  });
  // Reservation delivery (CM-UPDATES-V1): when the property has no PMS/CRS taking delivery,
  // new channel bookings are emailed to the configured reservation address(es).
  // "N new bookings" to a hotel that runs RevioLink alone — the same function as the scheduled pull
  // and the Channex webhook (`deliverNewBookings`), so the three can never disagree again.
  if (outcome.ok && outcome.imported > 0) {
    const delivered = await deliverNewBookings(channelId, outcome.imported);
    if (delivered.to.length > 0) {
      await logAudit(propertyId, tenantId, {
        entity: "Reservation delivery", field: "email", newValue: `${delivered.note} → ${delivered.to.join(", ")}`,
      });
    }
  }
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/sync");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// --- Property settings -----------------------------------------------------

export async function savePropertySettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { ok: false, error: _g.error };
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  const name = str(fd, "name");
  if (!name) return { ok: false, error: (await i18n()).t(settingsDict).errors.propertyName };

  // Currency is the property's single source of truth; channels inherit it (no per-channel currency).
  const newCurrency = str(fd, "baseCurrency") || "EUR";
  const currencyChanged = newCurrency !== property.baseCurrency;
  const convertRates = str(fd, "convertRates") === "true";
  const conversionRate = Number(str(fd, "conversionRate"));

  /*
   * ⚠️ ONE transaction, and here it matters more than anywhere in RevioLink.
   *
   * A currency change moves the property's currency, every channel's, and — optionally — multiplies
   * every stored price by the rate. Committed apart, a failure after the first left prices in the
   * old currency under the new symbol; and because the conversion is a MULTIPLY, pressing Save again
   * to "finish" it would have converted the prices that did convert a second time (atomic-lint,
   * 2026-09-29). All of it lands, or none of it does.
   */
  const converted = await withTenantTransaction(tenantId, async (tx) => {
    await tx.property.update({
      where: { id: propertyId },
      data: {
        name,
        timezone: str(fd, "timezone") || "Europe/Sofia",
        baseCurrency: newCurrency,
        syncHorizonDays: Math.max(1, int(fd, "syncHorizonDays", 365)),
        checkInTime: str(fd, "checkInTime") || "14:00",
        checkOutTime: str(fd, "checkOutTime") || "12:00",
        contactEmail: str(fd, "contactEmail") || null,
        phone: str(fd, "phone") || null,
      },
    });
    if (!currencyChanged) return 0;
    // Every channel inherits the property currency.
    await tx.channel.updateMany({ where: { propertyId }, data: { currency: newCurrency } });
    // Optionally convert every stored rate (Postgres rounds the product back to integer minor units).
    if (convertRates && Number.isFinite(conversionRate) && conversionRate > 0) {
      const res = await tx.ratePrice.updateMany({ where: { propertyId }, data: { priceMinor: { multiply: conversionRate }, source: "bulk", updatedAt: new Date() } });
      return res.count;
    }
    return 0;
  }, { timeout: 60_000 });

  await logAudit(propertyId, tenantId, {
    entity: `Property · ${name}`, field: "settings",
    newValue: currencyChanged ? `currency → ${newCurrency}${convertRates ? ` · ${converted} rates × ${conversionRate}` : " (display only)"}` : name,
  });
  revalidatePath("/settings", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/channels");
  return { ok: true };
}


/** Resolve/ignore an error item (spec §3.8: a capability warning offers one-click ignore; a real
 * error is resolved once its cause is fixed). Audited. */
export async function resolveErrorItem(fd: FormData): Promise<void> {
  await requireCapability("manageDistribution");
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  if (!id) return;
  const e = await prisma.errorItem.findUnique({ where: { id }, include: { channel: true } });
  if (!e || e.tenantId !== tenantId) return;
  await prisma.errorItem.update({ where: { id }, data: { resolved: true } });
  await logAudit(propertyId, tenantId, {
    entity: `Error · ${e.message.slice(0, 60)}`, field: "resolve",
    newValue: e.code === "restriction_not_supported" ? "ignored (capability limitation)" : "resolved",
    channelCode: e.channel?.code ?? null,
  });
  revalidatePath("/sync");
  revalidatePath("/dashboard");
}


// --- Reservation delivery & notifications (CM-UPDATES-V1 Settings) --------------------------

/** Save the delivery emails + arrival-summary notification settings. */
export async function saveDeliverySettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { ok: false, error: _g.error };
  const { id: propertyId, tenantId } = await getProperty();
  const primary = str(fd, "reservationEmailPrimary").toLowerCase() || null;
  const secondary = str(fd, "reservationEmailSecondary").toLowerCase() || null;
  const emailOk = (v: string | null) => v == null || /.+@.+\..+/.test(v);
  if (!emailOk(primary) || !emailOk(secondary)) return { ok: false, error: (await i18n()).t(settingsDict).errors.validEmails };
  const timeOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const todayTime = str(fd, "notifyTodayTime") || "07:00";
  const tomorrowTime = str(fd, "notifyTomorrowTime") || "18:00";
  if (!timeOk(todayTime) || !timeOk(tomorrowTime)) return { ok: false, error: (await i18n()).t(settingsDict).errors.sendTimes };
  const toOk = (v: string) => ["primary", "secondary", "both"].includes(v);
  const todayTo = toOk(str(fd, "notifyTodayTo")) ? str(fd, "notifyTodayTo") : "primary";
  const tomorrowTo = toOk(str(fd, "notifyTomorrowTo")) ? str(fd, "notifyTomorrowTo") : "primary";

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      reservationEmailPrimary: primary,
      reservationEmailSecondary: secondary,
      notifyTodayArrivals: fd.get("notifyTodayArrivals") === "on",
      notifyTodayTime: todayTime,
      notifyTodayTo: todayTo,
      notifyTomorrowArrivals: fd.get("notifyTomorrowArrivals") === "on",
      notifyTomorrowTime: tomorrowTime,
      notifyTomorrowTo: tomorrowTo,
    },
  });
  await logAudit(propertyId, tenantId, {
    entity: "Property · delivery settings", field: "reservation_delivery",
    newValue: `primary ${primary ?? "—"} · today ${fd.get("notifyTodayArrivals") === "on" ? todayTime : "off"} · tomorrow ${fd.get("notifyTomorrowArrivals") === "on" ? tomorrowTime : "off"}`,
  });
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/** Send a test email to the configured primary (or the platform test recipient). */
export async function sendTestEmail(): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const to = property.reservationEmailPrimary ?? process.env.EMAIL_TEST_RECIPIENT;
  if (!to) return;
  const testMail = {
    preview: `Delivery test for ${property.name}.`,
    heading: "Your reservation emails are working",
    product: "RevioLink",
    blocks: [
      { p: `This is a test of the reservation-delivery email for ${property.name}. If you can read this, delivery works.` },
      { note: `Sent ${new Date().toISOString()}.` },
    ],
  };
  const res = await sendEmail({
    to: [to],
    subject: `Revio test — ${property.name}`,
    text: renderSystemEmailText(testMail),
    html: renderSystemEmail(testMail),
  });
  await logAudit(property.id, property.tenantId, {
    entity: "Property · delivery settings", field: "test_email",
    newValue: res.ok ? `sent to ${to} (${res.mode})` : `failed: ${res.error}`,
  });
  revalidatePath("/settings", "layout");
}

export interface VerifyActionResult {
  ok?: boolean;
  error?: string;
  headline?: string;
  examples?: {
    kind: string; date: string; ours: number | null; theirs: number | null;
    roomTypeName?: string; ratePlanName?: string;
    /** The channel's own id — the only handle an `unexpected` finding has, since we never sent it. */
    externalRateId: string;
    /** The channel's name for that plan, when its catalogue could be read. */
    channelPlanName?: string;
    /** Set when the channel computes this plan from another — then it ignores the price we send. */
    derivedFrom?: string;
    /** A price on a plan nothing in Revio feeds — not ours, but possibly on sale at a stale number. */
    unmanaged?: boolean;
  }[];
  window?: string;
  /** The room-count half: how many rooms the channel offers against what we send. */
  rooms?: {
    ok: boolean; headline?: string; error?: string;
    examples?: { roomTypeName: string; date: string; ours: number; theirs: number | null; closedByStopSell: boolean }[];
  };
  /** Minimum/maximum stay, CTA, CTD, stop-sell — as the channel publishes them, against the push. */
  restrictions?: {
    ok: boolean; headline?: string; error?: string;
    examples?: { label: string; date: string; field: "minStay" | "maxStay" | "cta" | "ctd" | "stopSell"; ours: number | boolean; theirs: number | boolean | null }[];
  };
  /** Prices on plans the channel calculates from another, which it does not count — see `sortPriceFindings`. */
  followers?: number;
  /** The sentence for them, in the reader's language. */
  followersText?: string;
}

/**
 * Ask the channel what it is actually publishing.
 *
 * ⚠️ This is the only check in the product that reads the DESTINATION. Every other signal — the Sync
 * Center, the push summary, the channel's status pill — reports on the attempt, and a mis-mapped
 * push succeeds exactly like a correct one. On 13 September a €666 price sat published against the
 * wrong room for days with all of those green.
 */
export async function verifyChannelPublished(_prev: VerifyActionResult | null, fd: FormData): Promise<VerifyActionResult> {
  const _g = await guard("manageDistribution");
  if (!_g.ok) return { error: _g.error };
  const { id: propertyId } = await getProperty();

  const channelId = str(fd, "channelId");
  // Resolved against this property, never trusted from the form.
  const channel = await prisma.channel.findFirst({ where: { id: channelId, propertyId } });
  const ce = await sayCh();
  if (!channel) return { error: ce.verify.notHere };
  // Connectivity refuses a demo channel too, in English; said here first so it is in the reader's words.
  if (channel.connectivityMode === "mock") return { error: ce.verify.demo(channel.name) };

  const [result, rooms, restr, mapped] = await Promise.all([
    verifyPublished(prisma, channel.id),
    verifyPublishedAvailability(prisma, channel.id),
    verifyPublishedRestrictions(prisma, channel.id),
    prisma.channelRatePlanMapping.findMany({
      where: { channelId: channel.id, status: "complete", externalRateId: { not: null }, ratePlan: { active: true } },
      select: { externalRateId: true },
    }),
  ]);
  if (!result.ok || !result.summary) {
    // A failure to LOOK is reported as one, never as "nothing wrong".
    return { error: result.error ?? ce.verify.couldNotRead };
  }

  /*
   * ⚠️ The SAME rule as the daily read-back (`sortPriceFindings`), not this button's own.
   *
   * This used to count every difference, including prices on Channex's own copies of a plan for
   * each OTA ("BB BAR - BookingCom …") — 186 of them on Cabacum — and then advise mapping them,
   * which is exactly wrong: they follow their parent by themselves. The founder could not tell from
   * this screen which of the channel's plans were meant to be mapped (2026-09-29). Now a price on a
   * plan the channel calculates is not counted; the ones WE map to are still shown, because there
   * our price is being thrown away, and the rest are one sentence pointing at the plan list.
   */
  const mappedIds = new Set(mapped.map((m) => m.externalRateId!));
  const sorted = sortPriceFindings(result.problems ?? [], result.channelPlans, mappedIds);
  const derivedMapped = sorted.derived.filter((p) => mappedIds.has(p.externalRateId));
  const followers = sorted.derived.length - derivedMapped.length;
  const count = (k: string) => sorted.counted.filter((p) => p.kind === k).length;
  const sm = { mismatched: count("mismatch"), missing: count("missing"), unexpected: count("unexpected"), matched: result.summary.matched, checked: result.summary.checked };
  const restrictionFindings = restr.ok ? restr.findings.filter((f) => !result.channelPlans?.[f.externalRateId]?.derivedFrom) : [];
  const restrictionNights = new Set(restrictionFindings.map((f) => `${f.externalRateId}|${f.date}`)).size;

  /*
   * Remembered, so the channel card can say "checked, and it matched" rather than asking again.
   * `success` only when all three halves match; otherwise `warning` — a read that found
   * differences is not a verified channel. A failed read is not recorded: it proved nothing.
   */
  const clean = sorted.counted.length === 0 && rooms.ok && rooms.mismatched === 0 && restr.ok && restrictionNights === 0;
  await prisma.syncEvent.create({
    data: {
      tenantId: channel.tenantId, propertyId, channelId: channel.id, kind: "verify",
      status: clean ? "success" : "warning",
      summary: `Verified ${channel.name}: ${result.summary.headline}${rooms.ok ? ` · Rooms: ${rooms.headline}` : ""}` +
        (restr.ok ? ` · Restrictions: ${restrictionNights} of ${restr.checked} rate-plan nights differ` : ""),
    },
  });
  revalidatePath("/channels");

  const vp = ce.verify.prices;
  // A price we send to a plan the channel calculates is thrown away — never "exactly what we sent".
  const ignored = derivedMapped.filter((p) => p.kind === "mismatch").length;
  const headline = sm.checked === 0
    ? vp.nothing
    : sm.mismatched + sm.missing + sm.unexpected + ignored === 0
      ? vp.exact(sm.matched)
      : [
          sm.mismatched > 0 ? vp.mismatched(sm.mismatched) : null,
          sm.missing > 0 ? vp.missing(sm.missing) : null,
          sm.unexpected > 0 ? vp.unexpected(sm.unexpected) : null,
          ignored > 0 ? vp.ignored(ignored) : null,
        ].filter(Boolean).join(" · ");
  const vr = ce.verify.rooms;
  const roomsHeadline = rooms.checked === 0 ? vr.nothing : rooms.mismatched === 0 ? vr.exact(rooms.checked) : vr.off(rooms.mismatched, rooms.checked);
  const vx = ce.verify.restrictions;

  const unmanagedSet = new Set(sorted.unmanaged);
  const shown = [...sorted.counted.slice(0, 5), ...derivedMapped.slice(0, 3), ...sorted.unmanaged.slice(0, 2)];
  return {
    ok: true,
    headline,
    examples: shown.map((e) => {
      const plan = result.channelPlans?.[e.externalRateId];
      return {
        kind: e.kind, date: e.date, ours: e.ours, theirs: e.theirs, externalRateId: e.externalRateId,
        ...(e.roomTypeName ? { roomTypeName: e.roomTypeName } : {}),
        ...(e.ratePlanName ? { ratePlanName: e.ratePlanName } : {}),
        ...(plan ? { channelPlanName: plan.name } : {}),
        ...(plan?.derivedFrom ? { derivedFrom: plan.derivedFrom } : {}),
        ...(unmanagedSet.has(e) ? { unmanaged: true } : {}),
      };
    }),
    ...(followers > 0 ? { followers, followersText: ce.verify.followers(followers, channel.name) } : {}),
    window: `${result.from} → ${result.to}`,
    restrictions: restr.ok
      ? {
          ok: true,
          headline: restr.checked === 0 ? vx.nothing : restrictionNights === 0 ? vx.exact(restr.checked) : vx.off(restrictionNights, restr.checked),
          examples: restrictionFindings.slice(0, 5).map((f) => ({ label: f.label, date: f.date, field: f.field, ours: f.ours, theirs: f.theirs })),
        }
      : { ok: false, error: restr.error ?? ce.verify.couldNotReadRestrictions },
    rooms: rooms.ok
      ? { ok: true, headline: roomsHeadline, examples: rooms.examples }
      : { ok: false, error: rooms.error ?? ce.verify.couldNotReadRooms },
  };
}
