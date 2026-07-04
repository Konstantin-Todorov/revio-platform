"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { availableUnitsFor } from "./data";
import { ensureFolio, folioBalance } from "./folio";
import { logAudit, recordSync, str, int } from "./mutation-helpers";
import { todayInTz, addDaysYmd, utcDay } from "./format";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/housekeeping");
  revalidatePath("/rooms");
}

const SERVICEABLE = ["clean", "inspected"];

/**
 * Check a reservation in: assign a physical Unit to each room slot (one per line × quantity) and mark
 * the stay in-house (RoomAssignment.checkedInAt). Validates room-type match + serviceable + free unless
 * `override` is set (logged). All-or-nothing: any bad slot aborts before a single assignment is written.
 * Form: hidden reservationId + N `slot` fields each "lineId:unitId", optional `override` checkbox.
 */
export async function checkIn(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const override = fd.get("override") != null;

  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: session.activePropertyId },
    include: { lines: true },
  });
  if (!res) redirect("/dashboard");

  const slots = fd.getAll("slot").map(String).filter(Boolean);
  if (slots.length === 0) redirect(`/checkin/${reservationId}?error=pick`);

  const now = new Date();
  const seenUnits = new Set<string>();
  const specs: { lineId: string; unitId: string; unitLabel: string; checkIn: Date; checkOut: Date }[] = [];

  for (const s of slots) {
    const [lineId, unitId] = s.split(":");
    if (!lineId || !unitId) redirect(`/checkin/${reservationId}?error=pick`);
    if (seenUnits.has(unitId!)) redirect(`/checkin/${reservationId}?error=dup`);
    const line = res!.lines.find((l) => l.id === lineId);
    const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId: session.activePropertyId } });
    if (!line || !unit) redirect(`/checkin/${reservationId}?error=pick`);
    if (!override) {
      if (unit!.roomTypeId !== line!.roomTypeId) redirect(`/checkin/${reservationId}?error=type`);
      if (!SERVICEABLE.includes(unit!.hkStatus)) redirect(`/checkin/${reservationId}?error=dirty`);
    }
    const clash = await prisma.roomAssignment.count({
      where: { unitId: unitId!, status: "active", checkedOutAt: null, checkIn: { lt: line!.checkOut }, checkOut: { gt: line!.checkIn } },
    });
    if (clash > 0) redirect(`/checkin/${reservationId}?error=busy`);
    seenUnits.add(unitId!);
    specs.push({ lineId: line!.id, unitId: unit!.id, unitLabel: unit!.label, checkIn: line!.checkIn, checkOut: line!.checkOut });
  }

  for (const spec of specs) {
    await prisma.roomAssignment.create({
      data: {
        tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId,
        reservationLineId: spec.lineId, unitId: spec.unitId,
        checkIn: spec.checkIn, checkOut: spec.checkOut, status: "active", checkedInAt: now,
        ...(override ? { note: "assigned with override" } : {}),
      },
    });
    await logAudit(session.activePropertyId, session.tenantId, {
      entity: "check_in", field: spec.unitLabel,
      newValue: `#${reservationId.slice(-6)} ${res!.guestName}${override ? " (override)" : ""}`,
      userId: session.userId,
    });
  }
  // Open the folio so charges can be posted during the stay (Phase 3).
  await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  refresh();
  redirect("/dashboard");
}

/**
 * Check a reservation out: stamp checkedOutAt on its active assignments, set each vacated unit Dirty,
 * and close the folio. GATE: a non-zero folio balance blocks check-out (redirect to the folio to settle)
 * unless `override` is set — then the outstanding balance + reason are logged.
 */
export async function checkOut(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const override = fd.get("override") != null;
  const reason = str(fd, "reason");

  const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  if (folioId) {
    const lines = await prisma.folioLine.findMany({ where: { folioId }, select: { kind: true, amountMinor: true, voided: true } });
    const { balance } = folioBalance(lines);
    if (balance !== 0 && !override) redirect(`/folio/${reservationId}?error=balance`);
    if (balance !== 0 && override) {
      await logAudit(session.activePropertyId, session.tenantId, { entity: "checkout_override", field: `balance ${balance}`, newValue: reason || "no reason given", userId: session.userId });
    }
  }

  const assignments = await prisma.roomAssignment.findMany({
    where: { reservationId, propertyId: session.activePropertyId, status: "active", checkedOutAt: null },
    include: { unit: { select: { label: true } }, reservation: { select: { guestName: true } } },
  });
  const now = new Date();
  for (const a of assignments) {
    await prisma.roomAssignment.update({ where: { id: a.id }, data: { checkedOutAt: now } });
    await prisma.unit.update({ where: { id: a.unitId }, data: { hkStatus: "dirty" } });
    await logAudit(session.activePropertyId, session.tenantId, {
      entity: "check_out", field: a.unit.label, oldValue: a.reservation.guestName, newValue: "departed · room now dirty", userId: session.userId,
    });
  }
  if (folioId) await prisma.folio.update({ where: { id: folioId }, data: { status: "closed", closedAt: now } });
  refresh();
}

/** Move an in-house stay to a different unit: end the current assignment, open a new one, vacated unit → Dirty. */
export async function roomMove(fd: FormData): Promise<void> {
  const session = await ctx();
  const assignmentId = str(fd, "assignmentId");
  const newUnitId = str(fd, "unitId");

  const a = await prisma.roomAssignment.findFirst({
    where: { id: assignmentId, propertyId: session.activePropertyId, status: "active", checkedOutAt: null },
    include: { unit: { select: { label: true } } },
  });
  if (!a) redirect("/dashboard");
  const newUnit = await prisma.unit.findFirst({ where: { id: newUnitId, propertyId: session.activePropertyId } });
  if (!newUnit || newUnit.id === a!.unitId) redirect(`/move/${assignmentId}?error=pick`);

  const clash = await prisma.roomAssignment.count({
    where: { unitId: newUnitId, status: "active", checkedOutAt: null, checkIn: { lt: a!.checkOut }, checkOut: { gt: a!.checkIn }, id: { not: assignmentId } },
  });
  if (clash > 0) redirect(`/move/${assignmentId}?error=busy`);

  // End the old assignment (status "moved" — NOT a checkout, so it isn't counted as a departure).
  await prisma.roomAssignment.update({ where: { id: assignmentId }, data: { status: "moved" } });
  await prisma.roomAssignment.create({
    data: {
      tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId: a!.reservationId,
      reservationLineId: a!.reservationLineId, unitId: newUnitId, checkIn: a!.checkIn, checkOut: a!.checkOut,
      status: "active", checkedInAt: a!.checkedInAt ?? new Date(), note: `moved from ${a!.unit.label}`,
    },
  });
  await prisma.unit.update({ where: { id: a!.unitId }, data: { hkStatus: "dirty" } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "room_move", oldValue: a!.unit.label, newValue: newUnit!.label, userId: session.userId });
  refresh();
  redirect("/dashboard");
}

/**
 * Walk-in: create a same-day confirmed reservation (direct source, no channel) + guest, auto-assign the
 * first available unit, and check it in — all in one step. The new confirmed reservation reduces
 * availability on the shared waterfall (channels see it on the next push).
 */
export async function walkIn(fd: FormData): Promise<void> {
  const session = await ctx();
  const roomTypeId = str(fd, "roomTypeId");
  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const guests = Math.max(1, int(fd, "guests", 1));
  const nights = Math.min(60, Math.max(1, int(fd, "nights", 1)));

  if (!roomTypeId || !firstName || !lastName) redirect("/walkin?error=fields");

  const property = await prisma.property.findUnique({ where: { id: session.activePropertyId } });
  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId: session.activePropertyId } });
  const standard = await prisma.ratePlan.findFirst({ where: { propertyId: session.activePropertyId, priceLogic: "manual" }, orderBy: { sortOrder: "asc" } });
  if (!property || !roomType) redirect("/walkin?error=fields");
  if (!standard) redirect("/walkin?error=norate");

  const today = todayInTz(property!.timezone);
  const checkOut = addDaysYmd(today, nights);

  // Need a free, serviceable unit right now.
  const avail = await availableUnitsFor(roomTypeId, today, checkOut);
  const unit = avail.find((u) => u.available);
  if (!unit) redirect("/walkin?error=full");

  // Price from the standard plan's nightly rates over the stay (extrapolate if the window is short).
  const prices = await prisma.ratePrice.findMany({
    where: { roomTypeId, ratePlanId: standard!.id, date: { gte: utcDay(today), lt: utcDay(checkOut) } },
    select: { priceMinor: true },
  });
  let priceMinor = prices.reduce((s, p) => s + p.priceMinor, 0);
  if (prices.length > 0 && prices.length < nights) priceMinor = Math.round((priceMinor / prices.length) * nights);

  const guest = await prisma.guest.create({ data: { tenantId: session.tenantId, propertyId: session.activePropertyId, firstName, lastName } });
  const reservation = await prisma.reservation.create({
    data: {
      tenantId: session.tenantId, propertyId: session.activePropertyId, channelId: null,
      guestName: `${firstName} ${lastName}`, status: "confirmed",
      totalMinor: priceMinor, currency: property!.baseCurrency,
      propertyCurrency: property!.baseCurrency, propertyTotalMinor: priceMinor, fxRate: 1, fxAt: new Date(),
      guestId: guest.id, paymentGuarantee: "none", notes: "Walk-in (PMS)", createdById: session.userId,
      lines: { create: [{ roomTypeId, ratePlanId: standard!.id, quantity: 1, checkIn: utcDay(today), checkOut: utcDay(checkOut), priceMinor, guestsCount: guests }] },
    },
    include: { lines: true },
  });
  const line = reservation.lines[0]!;
  await prisma.roomAssignment.create({
    data: {
      tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId: reservation.id,
      reservationLineId: line.id, unitId: unit.id, checkIn: line.checkIn, checkOut: line.checkOut,
      status: "active", checkedInAt: new Date(),
    },
  });
  await ensureFolio(session.tenantId, session.activePropertyId, reservation.id);
  await logAudit(session.activePropertyId, session.tenantId, { entity: "walk_in", field: unit.label, newValue: `${firstName} ${lastName} · ${nights}n`, userId: session.userId });
  await recordSync(session.activePropertyId, session.tenantId, `Walk-in checked in — ${roomType!.name} ${unit.label}`, "1 room taken off sale (new confirmed stay) · sent to channels on next sync");
  refresh();
  redirect("/dashboard");
}
