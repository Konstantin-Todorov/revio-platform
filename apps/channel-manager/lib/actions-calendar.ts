"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { computeWaterfall, deriveRate, isOverbooking, ROOM_OCCUPYING_STATUSES, type DerivedRateConfig } from "@revio/core";
import { getProperty } from "./data";
import { logAudit, recordPush, recordPull, str, int, eachDate, utcDay } from "./mutation-helpers";
import type { PushField } from "./connectivity";

export type ActionResult = { ok: boolean; error?: string; affected?: number; warning?: string };

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/reservations");
  revalidatePath("/sync");
  revalidatePath("/audit");
}

/** The base manual rate plan id (prefer "BAR", else first manual). Null on a hotel without one. */
async function standardPlanId(propertyId: string): Promise<string | null> {
  const std =
    (await prisma.ratePlan.findFirst({ where: { propertyId, code: "BAR" } })) ??
    (await prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual" }, orderBy: { sortOrder: "asc" } }));
  return std?.id ?? null;
}

async function upsertCell(
  tenantId: string, propertyId: string, roomTypeId: string, date: Date,
  data: Partial<{ inventory: number; minLos: number | null; maxLos: number | null; cta: boolean; ctd: boolean; stopSell: boolean; advancePurchaseMin: number | null; advancePurchaseMax: number | null }>,
  source: "calendar" | "bulk" = "calendar", // two-tier provenance: which surface wrote this (spec §1.4)
) {
  await prisma.dailyCell.upsert({
    where: { roomTypeId_date: { roomTypeId, date } },
    update: { ...data, source },
    create: { tenantId, propertyId, roomTypeId, date, ...data, source },
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
    if (!ratePlanId) return; // no base rate plan to price against
    await prisma.ratePrice.upsert({
      where: { roomTypeId_ratePlanId_date: { roomTypeId: input.roomTypeId, ratePlanId, date } },
      update: { priceMinor, source: "calendar" },
      create: { tenantId, propertyId, roomTypeId: input.roomTypeId, ratePlanId, date, priceMinor, source: "calendar" },
    });
    await logAudit(propertyId, tenantId, { entity: `${rt.name} · Standard Rate`, field: "price", newValue: `€${priceMinor / 100}` });
  } else if (input.field === "inventory") {
    await upsertCell(tenantId, propertyId, input.roomTypeId, date, { inventory: Math.max(0, int2(input.value)) });
    await logAudit(propertyId, tenantId, { entity: `${rt.name}`, field: "rooms_to_sell", newValue: input.value });
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
  // Exactly what this edit touched — one date, one room type, one field. Anything wider would
  // restate values the user never opened (see PushScope).
  const FIELD_TO_PUSH: Record<string, PushField> = {
    price: "rate", inventory: "availability", minLos: "minStay",
    cta: "cta", ctd: "ctd", stopSell: "stopSell",
  };
  const touched = FIELD_TO_PUSH[input.field];
  await recordPush(propertyId, tenantId, `${rt.name} ${input.field} updated for ${input.date}`, {
    dates: [input.date],
    roomTypeIds: [input.roomTypeId],
    ...(touched ? { fields: [touched] } : {}),
  });
  revalidateCalendar();
}

function int2(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// --- Bulk update (multi-field, spec §3.1) ----------------------------------
// One pass sets any subset of the ARI attributes; empty fields are untouched. ≥1 field required.
// Same engine + same audit path as the single edits; the Calendar bulk modal calls this too (§2.1).

export type BulkRateMode = "set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt";
export interface BulkPayload {
  dateFrom: string;
  dateTo: string;
  daysOfWeek: number[];
  roomTypeIds: string[];
  ratePlanIds: string[]; // manual plans the price change targets
  rate?: { mode: BulkRateMode; value: number };
  minLos?: number | null; // >0 sets, ≤0 clears
  maxLos?: number | null;
  cta?: boolean;
  ctd?: boolean;
  stopSell?: boolean; // open/close (stop-sell): true = closed, false = open
  advanceMin?: number | null;
  advanceMax?: number | null;
  availability?: number; // rooms to sell
}
export type BulkResult = { ok: boolean; error?: string; affected?: number; warning?: string };

/** What one change actually wrote — enough to audit it and to build a push scope from it. */
interface WriteOutcome {
  error?: string;
  changed: string[];
  affected: number;
  dates: string[];
  roomTypeIds: string[];
  ratePlanIds: string[];
  /** The exact cells written. `ratePlanId` undefined = every plan of that room (a restriction). */
  cells: { roomTypeId: string; ratePlanId?: string; date: string }[];
  warning?: string;
}

/**
 * Write ONE bulk change and report what it touched — deliberately without pushing.
 *
 * The push is separated out because several changes can legitimately belong to one action: setting
 * three different prices on three different dates is one decision by the user, and sending it as
 * three API calls is both wasteful and, per Channex's certification, wrong ("1 call, batched").
 */
async function writeBulk(propertyId: string, tenantId: string, payload: BulkPayload): Promise<WriteOutcome> {
  const empty = { changed: [], affected: 0, dates: [], roomTypeIds: [], ratePlanIds: [], cells: [] };
  const { dateFrom, dateTo, daysOfWeek, roomTypeIds } = payload;
  if (!dateFrom || !dateTo) return { ...empty, error: "Pick a date range." };
  if (dateTo < dateFrom) return { ...empty, error: "End date is before start date." };
  if (roomTypeIds.length === 0) return { ...empty, error: "Select at least one room type." };

  // Assemble the DailyCell patch from whichever restriction fields were supplied.
  const cell: Partial<{ inventory: number; minLos: number | null; maxLos: number | null; cta: boolean; ctd: boolean; stopSell: boolean; advancePurchaseMin: number | null; advancePurchaseMax: number | null }> = {};
  const changed: string[] = [];
  const posOrNull = (v: number | null | undefined) => (v != null && v > 0 ? Math.trunc(v) : null);
  if (payload.minLos !== undefined) { cell.minLos = posOrNull(payload.minLos); changed.push("min_los"); }
  if (payload.maxLos !== undefined) { cell.maxLos = posOrNull(payload.maxLos); changed.push("max_los"); }
  if (payload.cta !== undefined) { cell.cta = payload.cta; changed.push("cta"); }
  if (payload.ctd !== undefined) { cell.ctd = payload.ctd; changed.push("ctd"); }
  if (payload.stopSell !== undefined) { cell.stopSell = payload.stopSell; changed.push("stop_sell"); }
  if (payload.advanceMin !== undefined) { cell.advancePurchaseMin = posOrNull(payload.advanceMin); changed.push("advance_min"); }
  if (payload.advanceMax !== undefined) { cell.advancePurchaseMax = posOrNull(payload.advanceMax); changed.push("advance_max"); }
  if (payload.availability !== undefined) { cell.inventory = Math.max(0, Math.trunc(payload.availability)); changed.push("availability"); }

  const doRate = !!payload.rate && Number.isFinite(payload.rate.value);
  if (doRate) changed.push("rate");

  // ≥1 field required (spec §3.1) — an empty apply is not a valid update.
  if (changed.length === 0) return { ...empty, error: "Set at least one field to update." };

  const dates = eachDate(dateFrom, dateTo, daysOfWeek);
  if (dates.length === 0) return { ...empty, error: "No dates match those days of week." };

  // Rate targeting: only MANUAL plans are price-edited (derived plans follow their parent).
  let ratePlanIds: string[] = [];
  if (doRate) {
    const requested = payload.ratePlanIds ?? [];
    const manualPlans = await prisma.ratePlan.findMany({
      where: { propertyId, priceLogic: "manual", active: true, ...(requested.length > 0 ? { id: { in: requested } } : {}) },
      select: { id: true }, orderBy: { sortOrder: "asc" },
    });
    ratePlanIds = manualPlans.map((p) => p.id);
    if (requested.length === 0) { const std = await standardPlanId(propertyId); ratePlanIds = std ? [std] : []; }
    if (ratePlanIds.length === 0) return { ...empty, error: "Select at least one manual rate plan for the price change (derived plans follow their parent)." };
  }

  // Total-rooms safety net (spec A4): more inventory than physically exists saves, but warns.
  let warning: string | undefined;
  if (payload.availability !== undefined) {
    const v = Math.max(0, Math.trunc(payload.availability));
    const over = await prisma.roomType.findMany({ where: { id: { in: roomTypeIds }, totalRooms: { lt: v } }, select: { name: true, totalRooms: true } });
    if (over.length > 0) warning = `${v} to sell exceeds the physical count for ${over.map((r) => `${r.name} (${r.totalRooms})`).join(", ")} — saved anyway, double-check the number.`;
  }

  const hasCell = Object.keys(cell).length > 0;
  let affected = 0;
  for (const roomTypeId of roomTypeIds) {
    for (const date of dates) {
      if (hasCell) await upsertCell(tenantId, propertyId, roomTypeId, date, cell, "bulk");
      if (doRate) {
        const { mode, value } = payload.rate!;
        for (const rpId of ratePlanIds) {
          const existing = await prisma.ratePrice.findUnique({ where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId: rpId, date } } });
          const base = existing?.priceMinor ?? 0;
          let next = base;
          if (mode === "set") next = Math.round(value * 100);
          else if (mode === "inc_pct") next = Math.round(base * (1 + value / 100));
          else if (mode === "dec_pct") next = Math.round(base * (1 - value / 100));
          else if (mode === "inc_amt") next = base + Math.round(value * 100);
          else if (mode === "dec_amt") next = Math.max(0, base - Math.round(value * 100));
          await prisma.ratePrice.upsert({
            where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId: rpId, date } },
            update: { priceMinor: next, source: "bulk" },
            create: { tenantId, propertyId, roomTypeId, ratePlanId: rpId, date, priceMinor: next, source: "bulk" },
          });
        }
      }
      affected++;
    }
  }

  const dateKeys = dates.map((d) => d.toISOString().slice(0, 10));
  // The exact cells, so a batched push does not re-assert the cross product of its axes. A rate
  // change names its rate plans; a restriction is stored per room type and so names none.
  const cells: WriteOutcome["cells"] = [];
  for (const roomTypeId of roomTypeIds) {
    for (const date of dateKeys) {
      if (hasCell) cells.push({ roomTypeId, date });
      if (doRate) for (const ratePlanId of ratePlanIds) cells.push({ roomTypeId, ratePlanId, date });
    }
  }

  return {
    changed, affected, roomTypeIds, cells,
    dates: dateKeys,
    // Rate plans narrow the scope only when a price changed; a restriction is written per room type.
    ratePlanIds: doRate ? ratePlanIds : [],
    ...(warning ? { warning } : {}),
  };
}

/** Which push field each bulk attribute maps to — the mask that keeps a rate push free of
 *  restrictions it was never asked to change. */
const BULK_TO_PUSH: Record<string, PushField> = {
  min_los: "minStay", max_los: "maxStay", cta: "cta", ctd: "ctd",
  stop_sell: "stopSell", availability: "availability", rate: "rate",
};

/** The union of what a set of changes touched, as one push scope. */
function scopeOf(outcomes: WriteOutcome[]): Parameters<typeof recordPush>[3] {
  const dates = new Set<string>();
  const rooms = new Set<string>();
  const plans = new Set<string>();
  const fields = new Set<PushField>();
  let anyRateChange = false;
  for (const o of outcomes) {
    for (const d of o.dates) dates.add(d);
    for (const r of o.roomTypeIds) rooms.add(r);
    for (const p of o.ratePlanIds) plans.add(p);
    for (const c of o.changed) {
      const f = BULK_TO_PUSH[c];
      if (f) fields.add(f);
      if (c === "rate") anyRateChange = true;
    }
  }
  return {
    dates: [...dates],
    roomTypeIds: [...rooms],
    // Narrowing to specific rate plans is only meaningful when a price moved; a restriction-only
    // change applies to every plan of the room, so leaving the axis open is the truthful scope.
    ...(anyRateChange && plans.size ? { ratePlanIds: [...plans] } : {}),
    ...(fields.size ? { fields: [...fields] } : {}),
    // The three axes above are independent, so on their own they describe a cross product. The cell
    // list is what keeps a batch of changes from restating values on dates nobody edited.
    cells: outcomes.flatMap((o) => o.cells),
  };
}

export async function applyBulkUpdateMulti(payload: BulkPayload): Promise<BulkResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const out = await writeBulk(propertyId, tenantId, payload);
  if (out.error) return { ok: false, error: out.error };

  // One apply = one audit entry recording every attribute changed (spec §3.1 build note).
  await logAudit(propertyId, tenantId, { entity: `Bulk update · ${out.roomTypeIds.length} room types`, field: out.changed.join(", "), newValue: `${out.affected} cells`, source: "bulk" });
  // One apply = one push carrying exactly the mask the user filled in, over exactly the rooms,
  // rate plans and dates they selected. This is what lets a bulk edit satisfy a certification test
  // that demands "1 API call" with specific values and nothing else in it.
  await recordPush(propertyId, tenantId, `Bulk update applied (${out.changed.join(", ")}) — ${out.affected} cells`, scopeOf([out]));
  revalidateCalendar();
  revalidatePath("/rooms-rates");
  return { ok: true, affected: out.affected, ...(out.warning ? { warning: out.warning } : {}) };
}

/**
 * Apply SEVERAL bulk changes as one action — written in order, then pushed **once**.
 *
 * A hotel setting a weekend rate, a holiday rate and a minimum stay is making one decision, and a
 * channel should hear about it once. It is also the only way to satisfy the certification tests
 * that name three different values on three different dates and allow exactly one API call.
 *
 * Changes are applied in order, so a later one deliberately overrides an earlier one on any date
 * they share — the same as typing them one after another, minus the traffic.
 */
export async function applyBulkUpdateBatch(payloads: BulkPayload[]): Promise<BulkResult> {
  const { id: propertyId, tenantId } = await getProperty();
  if (payloads.length === 0) return { ok: false, error: "Nothing to apply." };

  const outcomes: WriteOutcome[] = [];
  for (const [i, payload] of payloads.entries()) {
    const out = await writeBulk(propertyId, tenantId, payload);
    // Fail fast and say WHICH change was rejected: silently applying two of three and pushing them
    // would leave the hotel believing all three landed.
    if (out.error) return { ok: false, error: `Change ${i + 1}: ${out.error}` };
    outcomes.push(out);
  }

  const affected = outcomes.reduce((s, o) => s + o.affected, 0);
  const changed = [...new Set(outcomes.flatMap((o) => o.changed))];
  await logAudit(propertyId, tenantId, {
    entity: `Bulk update · ${payloads.length} changes`, field: changed.join(", "),
    newValue: `${affected} cells`, source: "bulk",
  });
  await recordPush(propertyId, tenantId, `Bulk update applied — ${payloads.length} changes, ${affected} cells`, scopeOf(outcomes));
  revalidateCalendar();
  revalidatePath("/rooms-rates");
  const warning = outcomes.find((o) => o.warning)?.warning;
  return { ok: true, affected, ...(warning ? { warning } : {}) };
}

// --- Live loop: simulate a booking ----------------------------------------

export async function simulateBooking(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
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
    parentRatePlanId: stdId ?? "",
    adjustmentType: ratePlan.derivedType as "percent" | "fixed",
    direction: (ratePlan.derivedDirection as "increase" | "decrease") ?? "decrease",
    value: ratePlan.derivedValue ?? 0,
    rounding: (ratePlan.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
  } : null;

  const rt = await prisma.roomType.findUniqueOrThrow({ where: { id: roomTypeId } });
  const checkInDate = utcDay(checkIn);
  const checkOutDate = new Date(checkInDate.getTime() + nights * 86_400_000);

  // Rooms already sold per night (derived from active reservations) + the date allotment, for the
  // overbooking check. We do NOT mutate inventory — availability = inventory − sold updates itself once
  // this reservation lands (sold is always derived).
  const [priorLines, cells, periods, activeHolds] = await Promise.all([
    prisma.reservationLine.findMany({
      where: {
        roomTypeId,
        reservation: { propertyId, status: { in: [...ROOM_OCCUPYING_STATUSES] } },
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    }),
    prisma.dailyCell.findMany({ where: { roomTypeId, date: { gte: checkInDate, lt: checkOutDate } } }),
    prisma.roomInventoryPeriod.findMany({ where: { roomTypeId, dateFrom: { lt: checkOutDate }, dateTo: { gte: checkInDate } } }),
    prisma.hold.findMany({
      where: { roomTypeId, status: "active", expiresAt: { gt: new Date() }, checkIn: { lt: checkOutDate }, checkOut: { gt: checkInDate } },
    }),
  ]);
  const invByDate = new Map(cells.map((c) => [c.date.toISOString().slice(0, 10), c.inventory]));

  for (const date of dates) {
    const sp = stdId ? await prisma.ratePrice.findUnique({ where: { roomTypeId_ratePlanId_date: { roomTypeId, ratePlanId: stdId, date } } }) : null;
    const stdMinor = sp?.priceMinor ?? 0;
    totalMinor += (derivedCfg ? deriveRate(stdMinor, derivedCfg) : stdMinor) * quantity;

    const k = date.toISOString().slice(0, 10);
    const sold = priorLines.filter((l) => l.checkIn <= date && date < l.checkOut).reduce((s, l) => s + l.quantity, 0);
    const held = activeHolds.filter((h) => h.checkIn <= date && date < h.checkOut).reduce((s, h) => s + h.quantity, 0);
    const remaining = computeWaterfall({
      physical: rt.totalRooms,
      outOfOrder: periods.filter((p) => p.kind === "out_of_order" && p.dateFrom <= date && date <= p.dateTo).reduce((s, p) => s + p.rooms, 0),
      closed: periods.filter((p) => p.kind === "closure" && p.dateFrom <= date && date <= p.dateTo).reduce((s, p) => s + p.rooms, 0),
      manualSellLimit: invByDate.get(k) ?? null,
      holds: held, confirmed: sold,
    }).remaining;
    if (isOverbooking(remaining)) overbooked = true;
  }

  // The channel inherits the property currency, so this booking is already in property currency
  // (FX rate 1). Real foreign-currency imports will set a real rate + converted amount here.
  const reservation = await prisma.reservation.create({
    data: {
      tenantId, propertyId, channelId, externalId: String(Math.floor(100000000 + Math.random() * 899999999)),
      guestName, status: overbooked ? "overbooked" : "confirmed",
      totalMinor, currency: property.baseCurrency,
      propertyCurrency: property.baseCurrency, propertyTotalMinor: totalMinor, fxRate: 1, fxAt: new Date(),
      lines: { create: [{ roomTypeId, ratePlanId, quantity, checkIn: checkInDate, checkOut: checkOutDate, priceMinor: totalMinor }] },
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

  // Cancelling drops the booking out of the "rooms sold" derivation, so availability
  // (inventory − sold) restores itself — no manual inventory edit needed.
  await prisma.reservation.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });

  await recordPush(propertyId, tenantId, `Availability restored after cancellation (${res.channel?.name ?? "Direct"})`);
  await logAudit(propertyId, tenantId, { entity: `Reservation · ${res.guestName}`, field: "cancel", newValue: "cancelled" });
  revalidateCalendar();
}
