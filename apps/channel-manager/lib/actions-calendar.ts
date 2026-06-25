"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@revio/db";
import { deriveRate, isOverbooking, type DerivedRateConfig } from "@revio/core";
import { getProperty } from "./data";
import { logAudit, recordPush, recordPull, str, int, strList, eachDate, utcDay } from "./mutation-helpers";

export type ActionResult = { ok: boolean; error?: string; affected?: number };

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/reservations");
  revalidatePath("/sync");
  revalidatePath("/audit");
}

async function standardPlanId(propertyId: string): Promise<string> {
  const std = await prisma.ratePlan.findFirstOrThrow({ where: { propertyId, code: "BAR" } });
  return std.id;
}

async function upsertCell(
  tenantId: string, propertyId: string, roomTypeId: string, date: Date,
  data: Partial<{ availabilityOverride: number; minLos: number | null; cta: boolean; ctd: boolean; stopSell: boolean }>,
) {
  await prisma.dailyCell.upsert({
    where: { roomTypeId_date: { roomTypeId, date } },
    update: data,
    create: { tenantId, propertyId, roomTypeId, date, ...data },
  });
}

// --- Single-cell inline edit ----------------------------------------------

export async function saveCell(input: { roomTypeId: string; date: string; field: string; value: string }): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const date = utcDay(input.date);
  const rt = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!rt) return;

  if (input.field === "price") {
    const priceMinor = Math.max(0, Math.round(parseFloat(input.value) * 100));
    const ratePlanId = await standardPlanId(propertyId);
    await prisma.ratePrice.upsert({
      where: { roomTypeId_ratePlanId_date: { roomTypeId: input.roomTypeId, ratePlanId, date } },
      update: { priceMinor },
      create: { tenantId, propertyId, roomTypeId: input.roomTypeId, ratePlanId, date, priceMinor },
    });
    await logAudit(propertyId, tenantId, { entity: `${rt.name} · Standard Rate`, field: "price", newValue: `€${priceMinor / 100}` });
  } else if (input.field === "availability") {
    await upsertCell(tenantId, propertyId, input.roomTypeId, date, { availabilityOverride: Math.max(0, int2(input.value)) });
    await logAudit(propertyId, tenantId, { entity: `${rt.name}`, field: "availability", newValue: input.value });
  } else if (input.field === "minLos") {
    const v = int2(input.value);
    await upsertCell(tenantId, propertyId, input.roomTypeId, date, { minLos: v > 0 ? v : null });
    await logAudit(propertyId, tenantId, { entity: `${rt.name}`, field: "min_los", newValue: v > 0 ? String(v) : "—" });
  } else if (input.field === "ctd" || input.field === "stopSell" || input.field === "cta") {
    const on = input.value === "true";
    await upsertCell(tenantId, propertyId, input.roomTypeId, date, { [input.field]: on } as any);
    await logAudit(propertyId, tenantId, { entity: `${rt.name}`, field: input.field, newValue: on ? "on" : "off" });
  } else {
    return;
  }
  await recordPush(propertyId, tenantId, `${rt.name} ${input.field} updated for ${input.date}`);
  revalidateCalendar();
}

function int2(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// --- Bulk update -----------------------------------------------------------

export async function applyBulkUpdate(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const dateFrom = str(fd, "dateFrom");
  const dateTo = str(fd, "dateTo");
  if (!dateFrom || !dateTo) return { ok: false, error: "Pick a date range." };
  if (dateTo < dateFrom) return { ok: false, error: "End date is before start date." };

  const roomTypeIds = strList(fd, "roomTypeIds");
  if (roomTypeIds.length === 0) return { ok: false, error: "Select at least one room type." };

  const dows = strList(fd, "daysOfWeek").map(Number);
  const updateType = str(fd, "updateType");
  const value = Number(str(fd, "value"));
  const dates = eachDate(dateFrom, dateTo, dows);
  if (dates.length === 0) return { ok: false, error: "No dates match those days of week." };

  const ratePlanId = await standardPlanId(propertyId);
  let affected = 0;

  for (const roomTypeId of roomTypeIds) {
    for (const date of dates) {
      if (updateType.startsWith("rate_")) {
        const existing = await prisma.ratePrice.findUnique({ where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId, date } } });
        const base = existing?.priceMinor ?? 0;
        let next = base;
        if (updateType === "rate_set") next = Math.round(value * 100);
        else if (updateType === "rate_inc_pct") next = Math.round(base * (1 + value / 100));
        else if (updateType === "rate_dec_pct") next = Math.round(base * (1 - value / 100));
        else if (updateType === "rate_inc_amt") next = base + Math.round(value * 100);
        else if (updateType === "rate_dec_amt") next = Math.max(0, base - Math.round(value * 100));
        await prisma.ratePrice.upsert({
          where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId, date } },
          update: { priceMinor: next },
          create: { tenantId, propertyId, roomTypeId, ratePlanId, date, priceMinor: next },
        });
      } else if (updateType === "availability_set") {
        await upsertCell(tenantId, propertyId, roomTypeId, date, { availabilityOverride: Math.max(0, Math.trunc(value)) });
      } else if (updateType === "minlos_set") {
        await upsertCell(tenantId, propertyId, roomTypeId, date, { minLos: value > 0 ? Math.trunc(value) : null });
      } else if (updateType === "stopsell_on" || updateType === "stopsell_off") {
        await upsertCell(tenantId, propertyId, roomTypeId, date, { stopSell: updateType === "stopsell_on" });
      }
      affected++;
    }
  }

  await logAudit(propertyId, tenantId, { entity: `Bulk update · ${roomTypeIds.length} room types`, field: updateType, newValue: `${affected} cells`, source: "bulk" });
  await recordPush(propertyId, tenantId, `Bulk update applied (${updateType}) — ${affected} cells`);
  revalidateCalendar();
  revalidatePath("/rooms-rates");
  return { ok: true, affected };
}

// --- Live loop: simulate a booking ----------------------------------------

export async function simulateBooking(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const channelId = str(fd, "channelId");
  const roomTypeId = str(fd, "roomTypeId");
  const ratePlanId = str(fd, "ratePlanId");
  const checkIn = str(fd, "checkIn");
  const nights = Math.max(1, int(fd, "nights", 1));
  const quantity = Math.max(1, int(fd, "quantity", 1));
  const guestName = str(fd, "guestName") || "Walk-in Guest";
  if (!channelId || !roomTypeId || !ratePlanId || !checkIn) return { ok: false, error: "Fill channel, room, rate and date." };

  const [channel, ratePlan, stdId] = await Promise.all([
    prisma.channel.findUnique({ where: { id: channelId } }),
    prisma.ratePlan.findUnique({ where: { id: ratePlanId } }),
    standardPlanId(propertyId),
  ]);
  if (!channel || !ratePlan) return { ok: false, error: "Unknown channel or rate plan." };

  const dates = Array.from({ length: nights }, (_, i) => utcDay(checkIn).getTime() + i * 86_400_000).map((t) => new Date(t));

  // Price the stay from the standard rate (+ derive if this rate plan is derived).
  let totalMinor = 0;
  let overbooked = false;
  const derivedCfg: DerivedRateConfig | null = ratePlan.priceLogic === "derived" && ratePlan.derivedType ? {
    parentRatePlanId: stdId,
    adjustmentType: ratePlan.derivedType as "percent" | "fixed",
    direction: (ratePlan.derivedDirection as "increase" | "decrease") ?? "decrease",
    value: ratePlan.derivedValue ?? 0,
    rounding: (ratePlan.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
  } : null;

  const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } });
  const checkInDate = utcDay(checkIn);
  const checkOutDate = new Date(checkInDate.getTime() + nights * 86_400_000);

  for (const date of dates) {
    const sp = await prisma.ratePrice.findUnique({ where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId: stdId, date } } });
    const stdMinor = sp?.priceMinor ?? 0;
    totalMinor += (derivedCfg ? deriveRate(stdMinor, derivedCfg) : stdMinor) * quantity;

    // Decrement availability for the night (the booking consumes inventory).
    const cell = await prisma.dailyCell.findUnique({ where: { roomTypeId_date: { roomTypeId, date } } });
    const current = cell?.availabilityOverride ?? rt.totalInventory;
    if (isOverbooking(current)) overbooked = true;
    await upsertCell(tenantId, propertyId, roomTypeId, date, { availabilityOverride: current - quantity });
  }

  const reservation = await prisma.reservation.create({
    data: {
      tenantId, propertyId, channelId, externalId: String(Math.floor(100000000 + Math.random() * 899999999)),
      guestName, status: overbooked ? "overbooked" : "confirmed", totalMinor, currency: channel.currency,
      lines: { create: [{ roomTypeId, ratePlanId, quantity, checkIn: checkInDate, checkOut: checkOutDate }] },
    },
  });

  await recordPull(propertyId, tenantId, `New reservation imported (${channel.name}) — ${guestName}`, channelId);
  await recordPush(propertyId, tenantId, `Availability re-pushed after booking on ${channel.name}`);
  await logAudit(propertyId, tenantId, { entity: `Reservation · ${guestName}`, field: "import", newValue: `${rt.name} ×${quantity} · ${nights}n`, source: "api" });

  if (overbooked) {
    await prisma.errorItem.create({
      data: {
        tenantId, propertyId, channelId, severity: "critical", code: "overbooking_detected",
        message: `Overbooking on ${rt.name}`, productLabel: `${channel.name} · ${rt.name}`,
        recommendedAction: "Resolve manually with the guest or move the booking", resolved: false,
      },
    });
    revalidatePath("/errors");
  }

  void reservation;
  revalidateCalendar();
  return { ok: true, affected: nights };
}

export async function cancelReservation(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const res = await prisma.reservation.findUnique({ where: { id }, include: { lines: true, channel: true } });
  if (!res || res.status === "cancelled") return;

  await prisma.reservation.update({ where: { id }, data: { status: "cancelled" } });

  // Restore the availability the booking had consumed.
  for (const line of res.lines) {
    const nights = Math.round((line.checkOut.getTime() - line.checkIn.getTime()) / 86_400_000);
    for (let i = 0; i < nights; i++) {
      const date = new Date(line.checkIn.getTime() + i * 86_400_000);
      const cell = await prisma.dailyCell.findUnique({ where: { roomTypeId_date: { roomTypeId: line.roomTypeId, date } } });
      if (cell?.availabilityOverride != null) {
        await prisma.dailyCell.update({ where: { roomTypeId_date: { roomTypeId: line.roomTypeId, date } }, data: { availabilityOverride: cell.availabilityOverride + line.quantity } });
      }
    }
  }
  await recordPush(propertyId, tenantId, `Availability restored after cancellation (${res.channel.name})`);
  await logAudit(propertyId, tenantId, { entity: `Reservation · ${res.guestName}`, field: "cancel", newValue: "cancelled" });
  revalidateCalendar();
}
