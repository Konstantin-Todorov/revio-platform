"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withTenantTransaction } from "@revio/db";
import { describeAccommodation, resolveRate } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { availableUnitsFor } from "./data";
import { repriceStay } from "./reprice";
import { repriceContext } from "./reprice-context";
import { ensureFolio, reservationBalance } from "./folio";
import { stayScope } from "@revio/connectivity";
import { logAudit, recordSync, str, int } from "./mutation-helpers";
import { todayInTz, addDaysYmd, utcDay, ymd } from "./format";

/**
 * Session + capability gate for every action in this file.
 *
 * The nav and the layout route-guard hide screens from scoped roles, but neither stops a WRITE:
 * Next runs a server action first and re-renders (re-guards) afterwards, so a crafted POST from a
 * housekeeper or outlet account would otherwise commit before the guard ever fired. Denial
 * redirects the caller to their own home screen, so nothing downstream in the action runs.
 */
async function ctx(cap: Capability) {
  const session = await getSession();
  if (!session) throw new Error("No session");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
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
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const override = fd.get("override") != null;

  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: session.activePropertyId },
    include: { lines: true },
  });
  if (!res) redirect("/dashboard");

  // A stay that has departed may not be checked in again. This is the guard whose absence produced
  // the state-machine bug: a reservation was checked out cleanly at 14:18, then checked in again at
  // 22:00, which created fresh `active` assignments on a stay whose folios were already closed. From
  // then on it read as in-house — overstaying by a night more every night, and drawing recurring
  // stay-extras onto a closed folio. A returning guest is a new reservation; a mistaken check-out is
  // undone by a manager with `reopenStay`, which is the sanctioned way back.
  if (res!.departedAt) redirect(`/reservation/${reservationId}?error=departed`);

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
 * Check a reservation out: mark the stay departed, stamp checkedOutAt on its active assignments, set
 * each vacated unit Dirty, and close every folio with a defined outcome. GATE: a non-zero balance
 * blocks check-out (redirect to the folio to settle) unless `override` is set — then the folio closes
 * as `outstanding` (a tracked receivable, §1.4) and the balance + reason are logged.
 *
 * ALL OF IT, OR NONE OF IT. This used to be a run of sequential awaits, and the gap between "folio
 * closed" and "assignments stamped" is exactly where production got a reservation whose folios were
 * all closed while it stayed in-house — the night audit then accrued charges against a guest who had
 * left, for 41 nights. There is no longer a path that closes the folio while the stay is still in the
 * house, because there is no longer a moment between the two.
 */
export async function checkOut(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const override = fd.get("override") != null;
  const reason = str(fd, "reason");

  // Outside the transaction on purpose: ensureFolio is itself a long write (it seeds accommodation,
  // taxes and fees), and holding row locks across it would keep the transaction open far longer than
  // the check-out needs. By the time we commit, the folio exists and its balance is re-read below.
  await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  const balance = await reservationBalance(reservationId);
  if (balance !== 0 && !override) redirect(`/folio/${reservationId}?error=balance`);

  const audits: { entity: string; field: string; oldValue?: string; newValue: string }[] = [];

  await withTenantTransaction(session.tenantId, async (tx) => {
    const now = new Date();
    const assignments = await tx.roomAssignment.findMany({
      where: { reservationId, propertyId: session.activePropertyId, status: "active", checkedOutAt: null },
      include: { unit: { select: { label: true } }, reservation: { select: { guestName: true } } },
    });

    for (const a of assignments) {
      await tx.roomAssignment.update({ where: { id: a.id }, data: { checkedOutAt: now } });
      await tx.unit.update({ where: { id: a.unitId }, data: { hkStatus: "dirty" } });
      audits.push({ entity: "check_out", field: a.unit.label, oldValue: a.reservation.guestName, newValue: "departed · room now dirty" });
    }

    // The fact that ends the stay. Without it, "in-house" was an aggregate over assignment rows that
    // a second check-in could silently re-create.
    await tx.reservation.update({ where: { id: reservationId }, data: { departedAt: now } });

    // A closed folio always says how it ended. `outstanding` is a managed state, not limbo: the money
    // is still owed, and the receivables view is where it is chased.
    await tx.folio.updateMany({
      where: { reservationId, status: "open" },
      data: { status: "closed", closedAt: now, outcome: balance === 0 ? "settled" : "outstanding" },
    });

    if (balance !== 0) {
      audits.push({ entity: "checkout_override", field: `balance ${balance}`, newValue: reason || "no reason given" });
    }
  });

  // Audit rows are written after the commit, deliberately: an audit trail describes what happened, and
  // a rolled-back check-out did not happen. Writing them inside would either vanish with the rollback
  // (pointless) or, if the audit write itself failed, roll back a good check-out (worse).
  for (const a of audits) {
    await logAudit(session.activePropertyId, session.tenantId, { ...a, userId: session.userId });
  }
  refresh();
}

/**
 * Move a stay by dragging its bar on the calendar (§2.5).
 *
 * A thin wrapper over the same `roomMove` the form uses — deliberately thin. A drag that took its
 * own path to the database would be a second implementation of the most state-heavy operation in
 * the product, and the one people reach for most casually. It gets the same transaction, the same
 * clash check, the same pinning and the same CRS boundary.
 *
 * What differs is only where you end up: the calendar is a place you work from, so a move made
 * there returns there rather than throwing you to the dashboard. Same principle as the folio modal
 * — act where you are.
 */
/**
 * Form entry point for the dedicated move screen. Always redirects, so it returns void the way a
 * `<form action>` requires — the calendar's variant is below and returns its outcome instead.
 */
export async function roomMoveForm(fd: FormData): Promise<void> {
  await ctx("frontDesk");
  await roomMove(fd);
}

export async function moveFromCalendar(fd: FormData): Promise<MoveOutcome> {
  // Gated here as well as in `roomMove`. This is its own POST endpoint, and a guarantee you have to
  // follow a delegation to find is one the next reader will not check for.
  await ctx("frontDesk");
  // `stay` is what makes this different from the form: no redirect, so the grid is never torn down
  // and rebuilt. A move made on the calendar should look like the bar moving, not like the page
  // reloading — the scroll position, the date window and the open floors all survive.
  fd.set("stay", "1");
  return roomMove(fd);
}

/**
 * Undo a check-out, so a stay that ended by mistake has a way back.
 *
 * This exists because of the rule the round established: no record may sit in a state with no
 * available action. Check-in now refuses a departed stay (it is what let a checked-out reservation be
 * resurrected as in-house), and a refusal with no inverse is just a different deadlock. Manager-only,
 * logged, and it reopens the folio it closed so charges can be corrected.
 *
 * It does NOT resurrect the old assignments: the rooms were released and may since have been given to
 * someone else. The stay comes back needing a fresh check-in, which is the honest description of the
 * situation.
 */
export async function reopenStay(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const reservationId = str(fd, "reservationId");
  const reason = str(fd, "reason");

  await withTenantTransaction(session.tenantId, async (tx) => {
    const res = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: session.activePropertyId },
      select: { id: true, departedAt: true },
    });
    if (!res) throw new Error("reopenStay: no such reservation in this property");

    await tx.reservation.update({ where: { id: reservationId }, data: { departedAt: null } });
    await tx.folio.updateMany({
      where: { reservationId, status: "closed" },
      data: { status: "open", closedAt: null, outcome: null },
    });
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "stay_reopened", field: `#${reservationId.slice(-6)}`,
    oldValue: "departed", newValue: reason || "no reason given", userId: session.userId,
  });
  refresh();
  redirect(`/reservation/${reservationId}`);
}

/** Move an in-house stay to a different unit: end the current assignment, open a new one, vacated unit → Dirty. */
const MOVE_REASONS = ["request", "upgrade", "maintenance", "noise"];

/** What a caller that stays put gets back instead of a redirect. */
export type MoveOutcome = { moved: true; crossType: boolean; reservationId: string } | void;

/**
 * Move a stay to a different room (§2.5) — the rebuild.
 *
 * ATOMIC. Ending the old assignment, opening the new one and dirtying the vacated room used to be
 * three sequential writes; a failure between them left a guest in two rooms or none. On a screen
 * whose whole purpose is knowing which room somebody is in, that is the §1 bug wearing a different
 * hat, and it is why this round insisted every state change here share that discipline.
 *
 * The new assignment is **pinned**: a person chose this room, so the optimiser never reconsiders it
 * (§2.3). That is the whole promise of a manual override — nobody is moved the night before arrival
 * because a score improved.
 *
 * **Across room types, the CRS record does not change** (§2.7). The guest booked a Standard; that
 * stays true in the CRS. The PMS records that they were accommodated in a Deluxe, in plain content
 * on the reservation's history, and emits NOTHING to channels — a front-desk upgrade is not a
 * distribution event. The physical room's occupancy changes, which the waterfall reads, and the
 * commercial record does not.
 *
 * The price difference is assessed here and stated; what to DO about it is a manager's choice on the
 * folio (comp, charge, refund, waive), never something this decides on their behalf.
 */
export async function roomMove(fd: FormData): Promise<MoveOutcome> {
  const session = await ctx("frontDesk");
  const assignmentId = str(fd, "assignmentId");
  const newUnitId = str(fd, "unitId");
  const reason = MOVE_REASONS.includes(str(fd, "reason")) ? str(fd, "reason") : "request";

  const a = await prisma.roomAssignment.findFirst({
    where: { id: assignmentId, propertyId: session.activePropertyId, status: "active", checkedOutAt: null },
    include: {
      unit: { select: { label: true, roomTypeId: true, roomType: { select: { name: true } } } },
      // ratePlanId + guestsCount: a CROSS-TYPE move reprices the stay against the new room type's
      // occupancy rates (§P7), and needs both to do it.
      line: { select: { id: true, roomTypeId: true, ratePlanId: true, guestsCount: true, roomType: { select: { name: true } } } },
    },
  });
  if (!a) redirect("/dashboard");
  const newUnit = await prisma.unit.findFirst({
    where: { id: newUnitId, propertyId: session.activePropertyId },
    include: { roomType: { select: { name: true, maxGuests: true, defaultOccupancy: true } } },
  });
  if (!newUnit || newUnit.id === a!.unitId) redirect(`/move/${assignmentId}?error=pick`);

  const clash = await prisma.roomAssignment.count({
    where: { unitId: newUnitId, status: "active", checkedOutAt: null, checkIn: { lt: a!.checkOut }, checkOut: { gt: a!.checkIn }, id: { not: assignmentId } },
  });
  if (clash > 0) redirect(`/move/${assignmentId}?error=busy`);

  // Booked (CRS) vs accommodated (PMS). Compared against the RESERVATION LINE's type, not the old
  // room's — after a previous cross-type move the old room is already not what was sold, and
  // comparing against it would call a move back to the booked type an "upgrade".
  const crossType = newUnit!.roomTypeId !== a!.line.roomTypeId;
  const accommodationNote = crossType
    ? describeAccommodation({
        bookedRoomTypeName: a!.line.roomType.name,
        bookedUnitLabel: a!.unit.label,
        accommodatedRoomTypeName: newUnit!.roomType.name,
        accommodatedUnitLabel: newUnit!.label,
      })
    : null;

  // Read OUTSIDE the transaction: it holds row locks while it runs, and a rate-plan read has no
  // business being in there.
  const repriceCtx = crossType ? await repriceContext(session.activePropertyId) : null;
  // The PROPERTY's today. A server in another timezone would reprice the wrong night at midnight.
  const propertyToday = repriceCtx
    ? todayInTz((await prisma.property.findUniqueOrThrow({ where: { id: session.activePropertyId }, select: { timezone: true } })).timezone)
    : "";

  await withTenantTransaction(session.tenantId, async (tx) => {
    // "moved", not "checked out" — the guest has not departed, and counting this as a departure
    // would put them in the day's checkout figures and the night audit's movements.
    await tx.roomAssignment.update({ where: { id: assignmentId }, data: { status: "moved" } });
    await tx.roomAssignment.create({
      data: {
        tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId: a!.reservationId,
        reservationLineId: a!.reservationLineId, unitId: newUnitId, checkIn: a!.checkIn, checkOut: a!.checkOut,
        status: "active",
        // Carried across UNCHANGED. It used to be `?? new Date()`, which was harmless while rooms
        // were only ever allocated at check-in — every assignment being moved had already arrived,
        // so the fallback never fired. Auto-assignment (§2.3) broke that: moving a booking for next
        // Tuesday silently marked the guest as arrived, put them in tonight's occupancy and the
        // night audit's revenue, and listed them on the minibar screen as a stay you could charge.
        // A move changes WHERE somebody is, never WHETHER they have arrived.
        checkedInAt: a!.checkedInAt,
        pinned: true,
        note: `moved from ${a!.unit.label} (${reason})`,
      },
    });
    await tx.unit.update({ where: { id: a!.unitId }, data: { hkStatus: "dirty" } });

    /*
     * A CROSS-TYPE move reprices the stay against the new room type — §P7 (K4).
     *
     * Inside this transaction on purpose: a move that lands with the old room's rates bills the
     * guest for a room they are not in, and a reprice that lands without the move is worse. Both or
     * neither.
     *
     * Same-type moves do not reprice — the rate did not change, only the room number did.
     *
     * ⚠️ This call was missing when K4 was first marked done. `repriceStay` existed, was tested, and
     * was invoked by nothing — the feature was a function nobody called.
     */
    if (crossType && repriceCtx) {
      const from = ymd(a!.checkIn) > propertyToday ? ymd(a!.checkIn) : propertyToday;
      await repriceStay({
        tx,
        tenantId: session.tenantId,
        reservationLineId: a!.reservationLineId,
        roomTypeId: newUnit!.roomTypeId,
        ratePlanId: a!.line.ratePlanId,
        maxOccupancy: newUnit!.roomType.maxGuests,
        roomDefaultOccupancy: newUnit!.roomType.defaultOccupancy,
        propertyModel: repriceCtx.propertyModel,
        plans: repriceCtx.plans,
        // The party size does not change with a move; only what it costs does.
        occupancy: a!.line.guestsCount ?? 1,
        // From today, or from arrival for a stay that has not started — never backwards over nights
        // already slept in the old room at the old rate.
        fromDate: from,
        reason: "room_move",
      });
    }
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "room_move", field: reason, oldValue: a!.unit.label, newValue: newUnit!.label, userId: session.userId,
  });
  if (accommodationNote) {
    await logAudit(session.activePropertyId, session.tenantId, {
      entity: "accommodated", field: `#${a!.reservationId.slice(-6)}`, newValue: accommodationNote, userId: session.userId,
    });
  }
  refresh();
  revalidatePath("/calendar");

  // A caller that wants to stay where it is passes `stay`, and gets the outcome back instead of a
  // redirect. The calendar uses it: §2.6's rule is that the user does not leave the grid, and a
  // cross-type move is a PROMPT there rather than a trip to another screen.
  if (str(fd, "stay") === "1") {
    return { moved: true, crossType, reservationId: a!.reservationId };
  }

  if (crossType) redirect(`/folio/${a!.reservationId}?moved=1`);
  const returnTo = str(fd, "returnTo");
  redirect(returnTo && returnTo.startsWith("/calendar") ? returnTo : "/dashboard");
}

/**
 * Walk-in: create a same-day confirmed reservation (direct source, no channel) + guest, auto-assign the
 * first available unit, and check it in — all in one step. The new confirmed reservation reduces
 * availability on the shared waterfall (channels see it on the next push).
 */
export async function walkIn(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
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

  /*
   * Price the stay at the party size actually walking in — and this had a real bug.
   *
   * ⚠️ It summed every RatePrice row in the window. That was correct while there was one row per
   * (room, plan, date), and OBP made it catastrophic: a per-person room now has one row PER GUEST
   * COUNT, so a 4-guest room charged the 1 + 2 + 3 + 4-guest prices added together — roughly four
   * times the rate, on a bill handed to somebody standing at the desk.
   *
   * Resolved through `resolveRate` now, which prices one night at one occupancy and is the same
   * function the booking engine and the Channex push use. The rows are read per occupancy and keyed,
   * never summed.
   */
  const walkInRoom = await prisma.roomType.findUniqueOrThrow({
    where: { id: roomTypeId }, select: { maxGuests: true, defaultOccupancy: true },
  });
  const walkInOccupancy = Math.max(1, Math.min(guests, walkInRoom.maxGuests));
  const stayNights: string[] = [];
  for (let i = 0; i < nights; i++) stayNights.push(addDaysYmd(today, i));

  const priceRows = await prisma.ratePrice.findMany({
    where: { roomTypeId, date: { gte: utcDay(today), lt: utcDay(checkOut) } },
    select: { roomTypeId: true, ratePlanId: true, date: true, occupancy: true, priceMinor: true },
  });
  const walkInMap = new Map(
    priceRows.map((r) => [`${r.roomTypeId}:${r.ratePlanId}:${ymd(r.date)}:${r.occupancy ?? ""}`, r.priceMinor]),
  );
  const walkInCtx = await repriceContext(session.activePropertyId);
  const walkInPlan = walkInCtx.plans.get(standard!.id);

  const quotedNights: { date: string; occupancy: number; rateMinor: number }[] = [];
  for (const d of stayNights) {
    const minor = walkInPlan
      ? resolveRate({
          lookup: (rt, rp, k, occ) => walkInMap.get(`${rt}:${rp}:${k}:${occ}`) ?? null,
          plans: walkInCtx.plans, roomTypeId,
          maxOccupancy: walkInRoom.maxGuests, roomDefaultOccupancy: walkInRoom.defaultOccupancy,
          propertyModel: walkInCtx.propertyModel, plan: walkInPlan,
          dateKey: d, occupancy: walkInOccupancy,
        })
      : null;
    if (minor != null) quotedNights.push({ date: d, occupancy: walkInOccupancy, rateMinor: minor });
  }
  let priceMinor = quotedNights.reduce((s, n) => s + n.rateMinor, 0);
  // A night with no rate is extrapolated from the ones that have one, rather than billed as free —
  // the guest is standing there and the room is not complimentary.
  if (quotedNights.length > 0 && quotedNights.length < nights) {
    priceMinor = Math.round((priceMinor / quotedNights.length) * nights);
  }

  const guest = await prisma.guest.create({ data: { tenantId: session.tenantId, propertyId: session.activePropertyId, firstName, lastName } });
  const reservation = await prisma.reservation.create({
    data: {
      tenantId: session.tenantId, propertyId: session.activePropertyId, channelId: null,
      guestName: `${firstName} ${lastName}`, status: "confirmed",
      totalMinor: priceMinor, currency: property!.baseCurrency,
      propertyCurrency: property!.baseCurrency, propertyTotalMinor: priceMinor, fxRate: 1, fxAt: new Date(),
      guestId: guest.id, paymentGuarantee: "none", notes: "Walk-in (PMS)", createdById: session.userId,
      lines: {
        create: [{
          roomTypeId, ratePlanId: standard!.id, quantity: 1,
          checkIn: utcDay(today), checkOut: utcDay(checkOut),
          priceMinor, guestsCount: walkInOccupancy,
          // The same per-night snapshot a channel or direct booking gets (§P4), so a walk-in's
          // folio explains itself and survives a mid-stay occupancy change like any other stay.
          ...(quotedNights.length === nights
            ? {
                nightRates: {
                  create: quotedNights.map((n) => ({
                    tenantId: session.tenantId,
                    date: utcDay(n.date),
                    occupancy: n.occupancy,
                    rateMinor: n.rateMinor,
                    source: "booking",
                  })),
                },
              }
            : {}),
        }],
      },
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
  await recordSync(session.activePropertyId, session.tenantId, `Availability reduced — ${roomType!.name}`, "1 room off sale (new confirmed stay)",
    stayScope([{ roomTypeId, checkIn: line.checkIn, checkOut: line.checkOut }]));
  refresh();
  redirect("/dashboard");
}

/**
 * Change the party size on a stay, and reprice from today forward — §P6 (K4).
 *
 * ## Why this exists at all
 *
 * There was no way to record that a guest added a second person. `guestsCount` was written once at
 * booking and never again, so under per-person pricing a stay that grew mid-week kept billing the
 * single rate — the folio quietly understating what the hotel was owed, with nothing on any screen
 * saying so.
 *
 * ## Atomic, and forward only
 *
 * The occupancy change and the repricing commit together: a stay that says "2 guests" while still
 * billing the one-guest rate is worse than either half alone, because both look right in isolation.
 *
 * Nights already slept keep their rate. A guest who adds someone on Thursday does not owe the double
 * rate for Monday, and those nights have very likely been posted to the folio already.
 */
export async function changeStayOccupancy(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const lineId = str(fd, "lineId");
  const requested = int(fd, "occupancy") ?? 0;

  const line = await prisma.reservationLine.findFirst({
    where: { id: lineId, reservation: { id: reservationId, propertyId: session.activePropertyId } },
    include: { roomType: { select: { id: true, maxGuests: true, defaultOccupancy: true } } },
  });
  if (!line) redirect(`/reservation/${reservationId}?error=notfound`);

  // The "doesn't fit" guard (§3.1) applies here as much as at booking: a room that sleeps two cannot
  // be sold to three, and letting the number through would price a party the room cannot hold.
  const occupancy = Math.max(1, Math.min(requested, line!.roomType.maxGuests));
  if (requested < 1 || requested > line!.roomType.maxGuests) {
    redirect(`/reservation/${reservationId}?error=occupancy`);
  }
  if (occupancy === line!.guestsCount) redirect(`/reservation/${reservationId}`);

  const previous = line!.guestsCount ?? occupancy;
  const repriceCtx = await repriceContext(session.activePropertyId);
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: session.activePropertyId }, select: { timezone: true },
  });
  const today = todayInTz(property.timezone);
  const from = ymd(line!.checkIn) > today ? ymd(line!.checkIn) : today;

  let outcome = { repriced: 0, unpriceable: [] as string[] };
  await withTenantTransaction(session.tenantId, async (tx) => {
    await tx.reservationLine.update({ where: { id: lineId }, data: { guestsCount: occupancy } });
    outcome = await repriceStay({
      tx,
      tenantId: session.tenantId,
      reservationLineId: lineId,
      roomTypeId: line!.roomType.id,
      ratePlanId: line!.ratePlanId,
      maxOccupancy: line!.roomType.maxGuests,
      roomDefaultOccupancy: line!.roomType.defaultOccupancy,
      propertyModel: repriceCtx.propertyModel,
      plans: repriceCtx.plans,
      occupancy,
      fromDate: from,
      reason: "occupancy_change",
    });
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "stay_occupancy",
    field: `#${reservationId.slice(-6)}`,
    oldValue: `${previous} guest(s)`,
    // What was repriced, and what could not be — a night the new party size has no rate for keeps
    // its old one, and somebody has to know.
    newValue:
      `${occupancy} guest(s) · ${outcome.repriced} night(s) repriced from ${from}` +
      (outcome.unpriceable.length > 0 ? ` · ${outcome.unpriceable.length} night(s) have no rate at this party size and kept the old one` : ""),
    userId: session.userId,
  });

  revalidatePath(`/reservation/${reservationId}`);
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/calendar");
}
