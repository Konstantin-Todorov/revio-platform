"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
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

  const incomplete = await prisma.productMapping.findMany({
    where: { channelId, status: { not: "complete" } },
    include: { roomType: true, ratePlan: true },
  });
  for (const m of incomplete) {
    await prisma.productMapping.update({
      where: { id: m.id },
      data: {
        status: "complete",
        externalRoomId: m.externalRoomId ?? `${channel.code}-r-${m.roomType.code}`,
        externalRateId: m.externalRateId ?? `${channel.code}-rp-${m.ratePlan.code}`,
      },
    });
  }
  await prisma.channel.update({ where: { id: channelId }, data: { errorCount: { set: Math.max(0, channel.errorCount - 1) } } });
  await logAudit(propertyId, tenantId, { entity: `Mapping · ${channel.name}`, field: "fix", newValue: `${incomplete.length} products mapped` });
  await recordPush(propertyId, tenantId, `Mapping completed for ${channel.name} (${incomplete.length} products)`);
  revalidatePath("/mapping");
  revalidatePath("/channels");
  revalidatePath("/dashboard");
}

/** Manually set a product's external IDs on a channel (self-service mapping against the mock). */
export async function updateMapping(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const externalRoomId = str(fd, "externalRoomId") || null;
  const externalRateId = str(fd, "externalRateId") || null;

  const mapping = await prisma.productMapping.findUnique({ where: { id }, include: { channel: true, roomType: true, ratePlan: true } });
  if (!mapping || mapping.tenantId !== tenantId) return { ok: false, error: "Mapping not found." };

  const status = externalRoomId && externalRateId ? "complete" : "incomplete";
  await prisma.productMapping.update({ where: { id }, data: { externalRoomId, externalRateId, status } });
  await logAudit(propertyId, tenantId, { entity: `Mapping · ${mapping.channel.name} · ${mapping.roomType.name}/${mapping.ratePlan.name}`, field: "mapping", newValue: status });
  await recordPush(propertyId, tenantId, `Mapping updated for ${mapping.channel.name}`);
  revalidatePath("/mapping");
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Channel settings & add channel ---------------------------------------

export async function saveChannelSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const currency = str(fd, "currency") || "EUR";
  const conversionType = str(fd, "conversionType") || "none";
  const markupPct = Number(str(fd, "markupPct")) || 0;
  const commissionPct = Number(str(fd, "commissionPct")) || 0;
  const rounding = str(fd, "rounding") || "none";

  const ch = await prisma.channel.findUnique({ where: { id } });
  if (!ch) return { ok: false, error: "Unknown channel." };
  await prisma.channel.update({ where: { id }, data: { currency, conversionType, markupPct, commissionPct, rounding } });
  await logAudit(propertyId, tenantId, { entity: `Channel · ${ch.name}`, field: "settings", newValue: `${currency} · ${markupPct}% markup` });
  await recordPush(propertyId, tenantId, `Channel settings updated for ${ch.name}`);
  revalidatePath("/channels");
  return { ok: true };
}

const KNOWN_OTAS: Record<string, string> = {
  booking: "Booking.com", expedia: "Expedia", trip: "Trip.com", agoda: "Agoda",
  airbnb: "Airbnb", hotelbeds: "Hotelbeds", hrs: "HRS", webbeds: "WebBeds",
};

export async function addChannel(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const code = str(fd, "code");
  const name = (KNOWN_OTAS[code] ?? str(fd, "name")) || code;
  const currency = str(fd, "currency") || "EUR";
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
  // Create complete mappings for all products so it's immediately sellable.
  const products = await prisma.ratePlanRoomType.findMany({ where: { ratePlan: { propertyId } }, include: { roomType: true, ratePlan: true } });
  await prisma.productMapping.createMany({
    data: products.map((p) => ({
      tenantId, channelId: channel.id, roomTypeId: p.roomTypeId, ratePlanId: p.ratePlanId,
      externalRoomId: `${code}-r-${p.roomType.code}`, externalRateId: `${code}-rp-${p.ratePlan.code}`, status: "complete",
    })),
  });
  await logAudit(propertyId, tenantId, { entity: `Channel · ${name}`, field: "connect", newValue: `${products.length} products mapped` });
  await recordPush(propertyId, tenantId, `Connected ${name} and pushed all products`);
  revalidatePath("/channels");
  revalidatePath("/dashboard");
  return { ok: true };
}

// --- Property settings -----------------------------------------------------

export async function savePropertySettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Property name is required." };
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      name,
      timezone: str(fd, "timezone") || "Europe/Sofia",
      baseCurrency: str(fd, "baseCurrency") || "EUR",
      syncHorizonDays: Math.max(1, int(fd, "syncHorizonDays", 365)),
      checkInTime: str(fd, "checkInTime") || "14:00",
      checkOutTime: str(fd, "checkOutTime") || "12:00",
      contactEmail: str(fd, "contactEmail") || null,
      phone: str(fd, "phone") || null,
    },
  });
  await logAudit(propertyId, tenantId, { entity: `Property · ${name}`, field: "settings", newValue: name });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
