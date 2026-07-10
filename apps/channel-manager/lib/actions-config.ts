"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { syncChannel, pullChannel, fullSyncChannel, pauseChannel, resumeChannel, disconnectChannel, reconnectChannel } from "./connectivity";
import { sendEmail, deliveryRecipients } from "./email";
import { getSession } from "./session";
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
  // Dropdown selection, or a hand-typed id when the OTA product isn't in the pulled list.
  const externalId = str(fd, "externalIdCustom") || str(fd, "externalId") || null;
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

/** Manual Sync (spec §3.5): a FULL 365-day recovery push — forces a drifted channel back into
 * agreement with the shared ARI, through the same queue/batching as every other push. */
export async function resyncChannel(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  if (!channelId) return;
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  const outcome = await fullSyncChannel(channelId);
  await logAudit(propertyId, tenantId, {
    entity: `Channel · ${ch?.name ?? channelId}`, field: "full_sync",
    newValue: `${outcome.pushed} pushed · ${outcome.rejected} rejected (${outcome.mode}, 365d)`,
    channelCode: ch?.code,
  });
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/errors");
  revalidatePath("/dashboard");
}

function revalidateChannels() {
  revalidatePath("/channels");
  revalidatePath("/sync");
  revalidatePath("/dashboard");
}

/** Pause (spec §3.5): reversible stop-sell overlay on one channel; the core ARI is untouched. */
export async function pauseChannelAction(fd: FormData): Promise<void> {
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
}

export async function resumeChannelAction(fd: FormData): Promise<void> {
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
}

export async function reconnectChannelAction(fd: FormData): Promise<void> {
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
  // Reservation delivery (CM-UPDATES-V1): when the property has no PMS/CRS taking delivery,
  // new channel bookings are emailed to the configured reservation address(es).
  if (outcome.ok && outcome.imported > 0) {
    const session = await getSession();
    const takesDeliveryElsewhere = session?.entitlements.reservation || session?.entitlements.pms;
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    const to = property ? deliveryRecipients(property, "both") : [];
    if (!takesDeliveryElsewhere && property && to.length > 0) {
      const fresh = await prisma.reservation.findMany({
        where: { propertyId, channelId },
        include: { channel: true, lines: { include: { roomType: true } } },
        orderBy: { importedAt: "desc" },
        take: outcome.imported,
      });
      const lines = fresh.map((r) => {
        const l = r.lines[0];
        return `#${r.externalId ?? r.id.slice(-6)} · ${r.guestName} · ${l ? `${l.roomType.name} ${l.checkIn.toISOString().slice(0, 10)} → ${l.checkOut.toISOString().slice(0, 10)}` : ""} · ${(r.totalMinor / 100).toFixed(2)} ${r.currency}`;
      });
      const res = await sendEmail({
        to,
        subject: `${fresh.length} new reservation${fresh.length > 1 ? "s" : ""} — ${property.name}`,
        text: `New bookings just imported from ${fresh[0]?.channel?.name ?? "a channel"}:\n\n${lines.join("\n")}\n\n— RevioLink`,
      });
      await logAudit(propertyId, tenantId, {
        entity: "Reservation delivery", field: "email",
        newValue: res.ok ? `${fresh.length} booking(s) emailed to ${to.join(", ")} (${res.mode})` : `failed: ${res.error}`,
      });
    }
  }
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


/** Resolve/ignore an error item (spec §3.8: a capability warning offers one-click ignore; a real
 * error is resolved once its cause is fixed). Audited. */
export async function resolveErrorItem(fd: FormData): Promise<void> {
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
  const { id: propertyId, tenantId } = await getProperty();
  const primary = str(fd, "reservationEmailPrimary").toLowerCase() || null;
  const secondary = str(fd, "reservationEmailSecondary").toLowerCase() || null;
  const emailOk = (v: string | null) => v == null || /.+@.+\..+/.test(v);
  if (!emailOk(primary) || !emailOk(secondary)) return { ok: false, error: "Enter valid email addresses." };
  const timeOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const todayTime = str(fd, "notifyTodayTime") || "07:00";
  const tomorrowTime = str(fd, "notifyTomorrowTime") || "18:00";
  if (!timeOk(todayTime) || !timeOk(tomorrowTime)) return { ok: false, error: "Send times must be HH:MM." };
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
  revalidatePath("/settings");
  return { ok: true };
}

/** Send a test email to the configured primary (or the platform test recipient). */
export async function sendTestEmail(): Promise<void> {
  const property = await getProperty();
  const to = property.reservationEmailPrimary ?? process.env.EMAIL_TEST_RECIPIENT;
  if (!to) return;
  const res = await sendEmail({
    to: [to],
    subject: `Revio test — ${property.name}`,
    text: `This is a test of the reservation-delivery email for ${property.name}. If you can read this, delivery works (${new Date().toISOString()}).`,
  });
  await logAudit(property.id, property.tenantId, {
    entity: "Property · delivery settings", field: "test_email",
    newValue: res.ok ? `sent to ${to} (${res.mode})` : `failed: ${res.error}`,
  });
  revalidatePath("/settings");
}
