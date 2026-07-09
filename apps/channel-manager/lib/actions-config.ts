"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { syncChannel, pullChannel } from "./connectivity";
import { logAudit, recordPush, str, int, strList, utcDay } from "./mutation-helpers";

export type ActionResult = { ok: boolean; error?: string };

const BOOL_TYPES = new Set(["stop_sell", "cta", "ctd"]);

// --- Restriction rules -----------------------------------------------------

export async function saveRestrictionRule(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const rowId = str(fd, "id");
  const name = str(fd, "name");
  const type = str(fd, "type");
  if (!name) return { ok: false, error: "Name is required." };
  if (!type) return { ok: false, error: "Pick a restriction type." };

  const dateFrom = str(fd, "dateFrom");
  const dateTo = str(fd, "dateTo");
  if (!dateFrom || !dateTo) return { ok: false, error: "Pick a date range." };

  const channelCodes = strList(fd, "channelCodes");
  const roomTypeId = str(fd, "roomTypeId") || null;
  const isBool = BOOL_TYPES.has(type);
  const valueInt = isBool ? null : Math.max(0, int(fd, "value"));
  const valueBool = isBool ? true : null;
  const priority = int(fd, "priority", 0);
  const active = fd.get("active") != null;

  const data = {
    tenantId, propertyId, name, type, roomTypeId, channelCodes,
    dateFrom: utcDay(dateFrom), dateTo: utcDay(dateTo), valueInt, valueBool, priority, active,
  };

  if (rowId) {
    await prisma.restrictionRule.update({ where: { id: rowId }, data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "edit", newValue: type, source: "rule" });
  } else {
    await prisma.restrictionRule.create({ data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "create", newValue: type, source: "rule" });
  }
  await recordPush(propertyId, tenantId, `Restriction rule "${name}" pushed`);
  revalidatePath("/restrictions");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteRestrictionRule(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const rule = await prisma.restrictionRule.findUnique({ where: { id } });
  if (!rule) return;
  await prisma.restrictionRule.delete({ where: { id } });
  await logAudit(propertyId, tenantId, { entity: `Restriction · ${rule.name}`, field: "delete", source: "rule" });
  revalidatePath("/restrictions");
}

// --- Mapping ---------------------------------------------------------------

export async function fixMappings(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return;

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
export async function updateStreamMapping(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const kind = str(fd, "kind");
  const id = str(fd, "id");
  const externalId = str(fd, "externalId") || null;
  const status = externalId ? "complete" : "incomplete";

  if (kind === "room") {
    const m = await prisma.channelRoomTypeMapping.findUnique({ where: { id }, include: { channel: true, roomType: true } });
    if (!m || m.tenantId !== tenantId) return { ok: false, error: "Mapping not found." };
    await prisma.channelRoomTypeMapping.update({ where: { id }, data: { externalRoomId: externalId, status } });
    await logAudit(propertyId, tenantId, { entity: `Mapping · ${m.channel.name} · ${m.roomType.name}`, field: "room mapping", newValue: status });
  } else {
    const m = await prisma.channelRatePlanMapping.findUnique({ where: { id }, include: { channel: true, ratePlan: true } });
    if (!m || m.tenantId !== tenantId) return { ok: false, error: "Mapping not found." };
    await prisma.channelRatePlanMapping.update({ where: { id }, data: { externalRateId: externalId, status } });
    await logAudit(propertyId, tenantId, { entity: `Mapping · ${m.channel.name} · ${m.ratePlan.name}`, field: "rate mapping", newValue: status });
  }
  await recordPush(propertyId, tenantId, "Mapping updated");
  revalidatePath("/mapping");
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Channel settings & add channel ---------------------------------------

export async function saveChannelSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
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
  if (!ch) return { ok: false, error: "Unknown channel." };
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
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  const code = str(fd, "code");
  const name = (KNOWN_OTAS[code] ?? str(fd, "name")) || code;
  const currency = property.baseCurrency; // inherit the property currency
  const externalPropertyId = str(fd, "externalPropertyId") || null;
  if (!code) return { ok: false, error: "Pick a channel." };

  const exists = await prisma.channel.findFirst({ where: { propertyId, code } });
  if (exists) return { ok: false, error: `${name} is already connected.` };

  const channel = await prisma.channel.create({
    data: {
      tenantId, propertyId, code, name, status: "connected", currency, externalPropertyId,
      supportedRestrictions: ["stop_sell", "min_los", "max_los", "cta", "advance_purchase_min"],
      lastSyncAt: new Date(), errorCount: 0, pendingCount: 0,
    },
  });
  // Map every room type and rate plan to the new channel (two streams) so it's immediately sellable.
  const [roomTypes, ratePlans] = await Promise.all([
    prisma.roomType.findMany({ where: { propertyId } }),
    prisma.ratePlan.findMany({ where: { propertyId } }),
  ]);
  await prisma.channelRoomTypeMapping.createMany({
    data: roomTypes.map((rt) => ({ tenantId, channelId: channel.id, roomTypeId: rt.id, externalRoomId: `${code}-r-${rt.code}`, status: "complete" })),
  });
  await prisma.channelRatePlanMapping.createMany({
    data: ratePlans.map((rp) => ({ tenantId, channelId: channel.id, ratePlanId: rp.id, externalRateId: `${code}-rp-${rp.code}`, status: "complete" })),
  });
  await logAudit(propertyId, tenantId, { entity: `Channel · ${name}`, field: "connect", newValue: `${roomTypes.length} rooms + ${ratePlans.length} rates mapped` });
  await recordPush(propertyId, tenantId, `Connected ${name} and pushed all products`);
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Re-sync a channel: build + push the next horizon of ARI through its resolved adapter (mock/Channex). */
export async function resyncChannel(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const outcome = await syncChannel(channelId);
  await logAudit(propertyId, tenantId, { entity: "Channel sync", field: "resync", newValue: `${outcome.pushed} pushed · ${outcome.rejected} rejected (${outcome.mode})` });
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/errors");
  revalidatePath("/dashboard");
}

/** Pull bookings from the channel now (new → imported, cancelled → restored, unmapped → Error Center). */
export async function pullChannelBookings(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const outcome = await pullChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: "Channel sync", field: "pull",
    newValue: outcome.ok ? `${outcome.imported} new · ${outcome.updated} updated (${outcome.mode})` : `failed: ${outcome.error ?? "unknown"}`,
    source: "api",
  });
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/errors");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// --- Property settings -----------------------------------------------------

export async function savePropertySettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Property name is required." };

  // Currency is the property's single source of truth; channels inherit it (no per-channel currency).
  const newCurrency = str(fd, "baseCurrency") || "EUR";
  const currencyChanged = newCurrency !== property.baseCurrency;
  const convertRates = str(fd, "convertRates") === "true";
  const conversionRate = Number(str(fd, "conversionRate"));

  await prisma.property.update({
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

  let converted = 0;
  if (currencyChanged) {
    // Every channel inherits the property currency.
    await prisma.channel.updateMany({ where: { propertyId }, data: { currency: newCurrency } });
    // Optionally convert every stored rate (Postgres rounds the product back to integer minor units).
    if (convertRates && Number.isFinite(conversionRate) && conversionRate > 0) {
      const res = await prisma.ratePrice.updateMany({ where: { propertyId }, data: { priceMinor: { multiply: conversionRate }, source: "bulk", updatedAt: new Date() } });
      converted = res.count;
    }
  }

  await logAudit(propertyId, tenantId, {
    entity: `Property · ${name}`, field: "settings",
    newValue: currencyChanged ? `currency → ${newCurrency}${convertRates ? ` · ${converted} rates × ${conversionRate}` : " (display only)"}` : name,
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/channels");
  return { ok: true };
}
