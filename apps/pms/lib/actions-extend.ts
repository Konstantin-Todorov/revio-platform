"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claimHold, withTenantTransaction, type TenantTx } from "@revio/db";
import {
  computeStayCharges, computeWaterfall, expandInventoryPeriods, resolveRate, ROOM_OCCUPYING_STATUSES, type ChargeLine,
} from "@revio/core";
import { stayScope } from "@revio/connectivity";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome } from "./roles";
import { repriceContext } from "./reprice-context";
import { ensureFolio } from "./folio";
import { postFolioLineWith } from "./posting";
import { logAudit, recordSync } from "./mutation-helpers";
import { utcDay, ymd } from "./format";
import { addedNights, extensionMode, feeDelta, spreadTotal, stayShapeOf, type ExtensionMode } from "./extend-stay";

/**
 * Extend a stay from the calendar — drag the end of a bar, see the price, confirm.
 *
 * Two server actions, because the price is a question before it is a write: `quoteExtension` says
 * what the extra nights cost and whether they can be had, and `extendStay` takes them. The write
 * never trusts the quote — it re-prices, claims the room type's inventory with `claimHold` (the
 * only correct way to take a room, see `@revio/db`), and claims the physical room inside the same
 * transaction that changes the stay. Two receptionists extending two guests into the last free
 * night cannot both win.
 *
 * The rules for WHICH record changes are in `extend-stay.ts`.
 */

const MAX_EXTENSION_NIGHTS = 30;

export type ExtensionRefusal = "not_found" | "not_movable" | "room_taken" | "sold_out" | "no_price" | "too_long" | "changed";

export interface ExtensionQuote {
  ok: true;
  mode: ExtensionMode;
  checkOut: string;
  newCheckOut: string;
  nights: { date: string; rateMinor: number | null }[];
  /** The quoted accommodation, or null when a night has no price and reception must type one. */
  accommodationMinor: number | null;
  /** Fees the extra nights add — the tourist tax above all — at the quoted accommodation. */
  fees: ChargeLine[];
  currency: string;
  ratePlanName: string;
  unitLabel: string;
}

/** Session + capability gate, the same shape as `actions-frontdesk.ts`. */
async function ctx(cap: "frontDesk") {
  const session = await getSession();
  if (!session) throw new Error("No session");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
  return session;
}

/** Everything both actions read about the stay being extended. */
async function loadStay(propertyId: string, assignmentId: string) {
  return prisma.roomAssignment.findFirst({
    where: { id: assignmentId, propertyId, status: "active", checkedOutAt: null },
    include: {
      unit: { select: { id: true, label: true } },
      line: {
        include: {
          roomType: { select: { id: true, name: true, totalRooms: true, maxGuests: true, defaultOccupancy: true } },
          ratePlan: { select: { id: true, name: true } },
          nightRates: { select: { date: true } },
        },
      },
      reservation: {
        include: {
          lines: true,
          folios: { where: { isPrimary: true }, select: { id: true, status: true } },
        },
      },
    },
  });
}
type Stay = NonNullable<Awaited<ReturnType<typeof loadStay>>>;

/** Today's price of each added night on the stay's own plan, at the party size it is priced at. */
async function priceNights(stay: Stay, nights: string[]) {
  const line = stay.line;
  const ctx = await repriceContext(stay.propertyId);
  const plan = ctx.plans.get(line.ratePlanId);
  const rows = await prisma.ratePrice.findMany({
    where: { roomTypeId: line.roomTypeId, date: { gte: utcDay(nights[0]!), lte: utcDay(nights[nights.length - 1]!) } },
    select: { roomTypeId: true, ratePlanId: true, date: true, occupancy: true, priceMinor: true },
  });
  const map = new Map(rows.map((r) => [`${r.roomTypeId}:${r.ratePlanId}:${ymd(r.date)}:${r.occupancy ?? ""}`, r.priceMinor]));
  const occupancy = Math.max(1, Math.min(line.guestsCount ?? 1, line.roomType.maxGuests));
  return {
    occupancy,
    nights: nights.map((date) => ({
      date,
      rateMinor: plan
        ? resolveRate({
            lookup: (rt, rp, k, occ) => map.get(`${rt}:${rp}:${k}:${occ}`) ?? null,
            plans: ctx.plans, roomTypeId: line.roomTypeId,
            maxOccupancy: line.roomType.maxGuests, roomDefaultOccupancy: line.roomType.defaultOccupancy,
            propertyModel: ctx.propertyModel, plan, dateKey: date, occupancy,
          })
        : null,
    })),
  };
}

/**
 * The sellable base per night for the room type — physical minus out-of-order minus closed, or the
 * manual override. The half of the waterfall `claimHold` takes from its caller; it re-counts holds
 * and bookings itself, inside its lock.
 */
async function sellableBase(roomTypeId: string, totalRooms: number, nights: string[]) {
  const start = utcDay(nights[0]!);
  const end = utcDay(nights[nights.length - 1]!);
  const [cells, periods, holds, lines] = await Promise.all([
    prisma.dailyCell.findMany({ where: { roomTypeId, date: { gte: start, lte: end }, ratePlanId: null, inventory: { not: null } } }),
    prisma.roomInventoryPeriod.findMany({ where: { roomTypeId, dateFrom: { lte: end }, dateTo: { gte: start } } }),
    prisma.hold.findMany({ where: { roomTypeId, status: "active", expiresAt: { gt: new Date() }, checkIn: { lte: end }, checkOut: { gt: start } } }),
    prisma.reservationLine.findMany({
      where: { roomTypeId, reservation: { status: { in: [...ROOM_OCCUPYING_STATUSES] } }, checkIn: { lte: end }, checkOut: { gt: start } },
      select: { checkIn: true, checkOut: true, quantity: true },
    }),
  ]);
  const override = new Map(cells.map((c) => [ymd(c.date), c.inventory!]));
  const byDate = expandInventoryPeriods(
    periods.map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms })),
    nights,
  );
  const sellable: Record<string, number> = {};
  let remaining = Number.POSITIVE_INFINITY;
  for (const k of nights) {
    const d = utcDay(k);
    const { outOfOrder, closed } = byDate.get(k)!;
    const w = computeWaterfall({
      physical: totalRooms, outOfOrder, closed, manualSellLimit: override.get(k) ?? null,
      holds: holds.filter((h) => h.checkIn <= d && d < h.checkOut).reduce((s, h) => s + h.quantity, 0),
      confirmed: lines.filter((l) => l.checkIn <= d && d < l.checkOut).reduce((s, l) => s + l.quantity, 0),
    });
    sellable[k] = w.available;
    remaining = Math.min(remaining, w.remaining);
  }
  return { sellable, remaining };
}

/** Is the physical room free on the added nights? Another stay may start the day this one ends. */
async function roomFree(client: TenantTx | typeof prisma, unitId: string, from: Date, to: Date, ownId: string) {
  // The request proxy and a transaction expose the same delegate with different generics.
  const db = client as Pick<TenantTx, "roomAssignment">;
  const clash = await db.roomAssignment.count({
    where: { unitId, status: "active", checkedOutAt: null, id: { not: ownId }, checkIn: { lt: to }, checkOut: { gt: from } },
  });
  return clash === 0;
}

/** The fees the extra nights add, worked out the way the folio was seeded. */
async function extensionFees(stay: Stay, newCheckOut: string, addedMinor: number): Promise<ChargeLine[]> {
  const r = stay.reservation;
  const [fees, defaults] = await Promise.all([
    prisma.taxFee.findMany({ where: { propertyId: stay.propertyId, active: true, inclusion: "excluded" } }),
    prisma.propertyDefaults.findUnique({ where: { propertyId: stay.propertyId }, select: { cityTaxMode: true } }),
  ]);
  const cityTaxIncluded = defaults?.cityTaxMode === "included";
  const mode = extensionMode(r, stay.line.quantity);
  if (mode === "linked") {
    // A stay of its own: its fees are the full set for those nights, as its folio will be seeded.
    const l = { ...stay.line, quantity: 1, checkIn: stay.checkOut, checkOut: utcDay(newCheckOut) };
    return computeStayCharges({ stay: stayShapeOf([l], addedMinor), fees, cityTaxIncluded }).lines;
  }
  const accom = r.lines.reduce((s, l) => s + (l.priceMinor ?? 0), 0);
  const before = computeStayCharges({ stay: stayShapeOf(r.lines, accom), fees, cityTaxIncluded });
  const after = computeStayCharges({
    stay: stayShapeOf(r.lines.map((l) => (l.id === stay.line.id ? { ...l, checkOut: utcDay(newCheckOut) } : l)), accom + addedMinor),
    fees, cityTaxIncluded,
  });
  return feeDelta(before.lines, after.lines);
}

/** What extending this stay to `newCheckOut` would cost, and whether it can be done. */
export async function quoteExtension(assignmentId: string, newCheckOut: string): Promise<ExtensionQuote | { ok: false; code: ExtensionRefusal }> {
  const session = await ctx("frontDesk");
  const stay = await loadStay(session.activePropertyId, assignmentId);
  if (!stay) return { ok: false, code: "not_found" };
  if (stay.reservation.departedAt || stay.reservation.status === "cancelled") return { ok: false, code: "not_movable" };
  const checkOut = ymd(stay.checkOut);
  const nights = addedNights(checkOut, newCheckOut);
  if (nights.length === 0) return { ok: false, code: "changed" };
  if (nights.length > MAX_EXTENSION_NIGHTS) return { ok: false, code: "too_long" };

  if (!(await roomFree(prisma, stay.unitId, stay.checkOut, utcDay(newCheckOut), stay.id))) return { ok: false, code: "room_taken" };
  const { remaining } = await sellableBase(stay.line.roomTypeId, stay.line.roomType.totalRooms, nights);
  if (remaining < 1) return { ok: false, code: "sold_out" };

  const priced = await priceNights(stay, nights);
  const complete = priced.nights.every((n) => n.rateMinor != null);
  const accommodationMinor = complete ? priced.nights.reduce((s, n) => s + n.rateMinor!, 0) : null;
  const property = await prisma.property.findUniqueOrThrow({ where: { id: session.activePropertyId }, select: { baseCurrency: true } });

  return {
    ok: true,
    mode: extensionMode(stay.reservation, stay.line.quantity),
    checkOut,
    newCheckOut,
    nights: priced.nights,
    accommodationMinor,
    // Unpriced, the fixed fees are still known — the tourist tax does not wait for a room rate.
    fees: await extensionFees(stay, newCheckOut, accommodationMinor ?? 0),
    currency: property.baseCurrency,
    ratePlanName: stay.line.ratePlan.name,
    unitLabel: stay.unit.label,
  };
}

export type ExtensionOutcome =
  | { ok: true; mode: ExtensionMode; reservationId: string; newCheckOut: string }
  | { ok: false; code: ExtensionRefusal };

/**
 * Take the extra nights. Form: `assignmentId`, `checkOut` (what the screen showed as the current
 * departure — refused if it moved), `newCheckOut`, `totalMinor` (accommodation for the added nights,
 * as reception confirmed or changed it).
 */
export async function extendStay(fd: FormData): Promise<ExtensionOutcome> {
  const session = await ctx("frontDesk");
  const assignmentId = String(fd.get("assignmentId") ?? "");
  const expectedCheckOut = String(fd.get("checkOut") ?? "");
  const newCheckOut = String(fd.get("newCheckOut") ?? "");
  const typed = Number.parseInt(String(fd.get("totalMinor") ?? ""), 10);
  if (!Number.isFinite(typed) || typed < 0) return { ok: false, code: "no_price" };

  const stay = await loadStay(session.activePropertyId, assignmentId);
  if (!stay) return { ok: false, code: "not_found" };
  if (stay.reservation.departedAt || stay.reservation.status === "cancelled") return { ok: false, code: "not_movable" };
  const checkOut = ymd(stay.checkOut);
  if (checkOut !== expectedCheckOut) return { ok: false, code: "changed" };
  const nights = addedNights(checkOut, newCheckOut);
  if (nights.length === 0) return { ok: false, code: "changed" };
  if (nights.length > MAX_EXTENSION_NIGHTS) return { ok: false, code: "too_long" };

  const mode = extensionMode(stay.reservation, stay.line.quantity);
  const priced = await priceNights(stay, nights);
  const rates = spreadTotal(priced.nights.map((n) => n.rateMinor ?? 0), typed);
  const fees = await extensionFees(stay, newCheckOut, typed);
  const { sellable } = await sellableBase(stay.line.roomTypeId, stay.line.roomType.totalRooms, nights);
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: session.activePropertyId }, select: { timezone: true, baseCurrency: true },
  });

  // The room type's inventory first, atomically. The physical room is claimed inside the transaction.
  const claim = await claimHold({
    tenantId: session.tenantId, propertyId: session.activePropertyId, roomTypeId: stay.line.roomTypeId,
    quantity: 1, checkIn: checkOut, checkOut: newCheckOut,
    expiresAt: new Date(Date.now() + 5 * 60_000), createdById: session.userId, sellableByNight: sellable,
  });
  if (!claim.ok) return { ok: false, code: "sold_out" };

  const from = stay.checkOut;
  const to = utcDay(newCheckOut);
  const r = stay.reservation;
  const label = `${stay.line.roomType.name} · ${checkOut}→${newCheckOut}`;

  const result = await withTenantTransaction(session.tenantId, async (tx): Promise<ExtensionOutcome> => {
    // The same lock every room claim takes (`claim-unit.ts`), so a check-in or a move into this
    // room cannot land on these nights between the check and the write.
    await tx.$queryRaw`SELECT id FROM "Unit" WHERE id = ${stay.unitId} FOR UPDATE`;
    if (!(await roomFree(tx, stay.unitId, from, to, stay.id))) return { ok: false, code: "room_taken" };

    if (mode === "extend") {
      const moved = await tx.roomAssignment.updateMany({
        where: { id: stay.id, status: "active", checkedOutAt: null, checkOut: from },
        data: { checkOut: to },
      });
      if (moved.count !== 1) return { ok: false, code: "changed" };
      await tx.reservationLine.update({
        where: { id: stay.line.id },
        data: { checkOut: to, priceMinor: (stay.line.priceMinor ?? 0) + typed },
      });
      // Extend the per-night snapshot only when it covers the stay; a partial one would make the
      // folio bill the snapshot and lose the nights before it.
      const originalNights = addedNights(ymd(stay.line.checkIn), checkOut).length;
      if (stay.line.nightRates.length === originalNights) {
        await tx.reservationNightRate.createMany({
          data: nights.map((date, i) => ({
            tenantId: session.tenantId, reservationLineId: stay.line.id, date: utcDay(date),
            occupancy: priced.occupancy, rateMinor: rates[i]!, source: "booking",
          })),
        });
      }
      await tx.reservation.update({
        where: { id: r.id },
        data: {
          totalMinor: r.totalMinor + typed,
          ...(r.propertyTotalMinor != null ? { propertyTotalMinor: r.propertyTotalMinor + typed } : {}),
          ...(r.status === "confirmed" ? { status: "modified" } : {}),
        },
      });
      // A folio already opened was seeded with the old stay; it gets the new nights as their own
      // lines. One not yet opened is seeded later from the extended line, and needs nothing.
      const folio = r.folios[0];
      if (folio && folio.status === "open") {
        const base = { tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folio.id, postedById: session.userId };
        await postFolioLineWith(tx, { ...base, kind: "accommodation", description: `${label} (extension)`, amountMinor: typed });
        for (const f of fees) await postFolioLineWith(tx, { ...base, kind: f.kind, description: f.name, amountMinor: f.amountMinor });
      }
      await tx.hold.updateMany({ where: { id: claim.holdId, status: "active" }, data: { status: "converted", reservationId: r.id } });
      return { ok: true, mode, reservationId: r.id, newCheckOut };
    }

    // LINKED — a reservation of our own for the extra nights, in the same room, payable here.
    const created = await tx.reservation.create({
      data: {
        tenantId: session.tenantId, propertyId: session.activePropertyId, channelId: null,
        guestName: r.guestName, guestId: r.guestId, guestLanguage: r.guestLanguage, status: "confirmed",
        totalMinor: typed, currency: property.baseCurrency,
        propertyCurrency: property.baseCurrency, propertyTotalMinor: typed, fxRate: 1, fxAt: new Date(),
        paymentGuarantee: "none", bookingGroupId: r.bookingGroupId ?? r.id, createdById: session.userId,
        notes: `Extension of #${r.id.slice(-6)} — payable at the hotel`,
        lines: {
          create: [{
            roomTypeId: stay.line.roomTypeId, ratePlanId: stay.line.ratePlanId, quantity: 1,
            checkIn: from, checkOut: to, priceMinor: typed,
            guestsCount: stay.line.guestsCount, childrenCount: stay.line.childrenCount,
            infantsCount: stay.line.infantsCount, childAges: stay.line.childAges,
            nightRates: {
              create: nights.map((date, i) => ({
                tenantId: session.tenantId, date: utcDay(date), occupancy: priced.occupancy, rateMinor: rates[i]!, source: "booking",
              })),
            },
          }],
        },
      },
      include: { lines: true },
    });
    if (!r.bookingGroupId) await tx.reservation.update({ where: { id: r.id }, data: { bookingGroupId: r.id } });
    await tx.roomAssignment.create({
      data: {
        tenantId: session.tenantId, propertyId: session.activePropertyId, reservationId: created.id,
        reservationLineId: created.lines[0]!.id, unitId: stay.unitId, checkIn: from, checkOut: to, status: "active",
        // The guest is already in the room if the first stay is; the second is not a new arrival.
        checkedInAt: stay.checkedInAt ? new Date() : null, pinned: true, note: `extension of #${r.id.slice(-6)}`,
      },
    });
    await tx.hold.updateMany({ where: { id: claim.holdId, status: "active" }, data: { status: "converted", reservationId: created.id } });
    if (stay.checkedInAt) await ensureFolio(session.tenantId, session.activePropertyId, created.id, tx);
    return { ok: true, mode, reservationId: created.id, newCheckOut };
  });

  if (!result.ok) {
    await prisma.hold.updateMany({ where: { id: claim.holdId, status: "active" }, data: { status: "released" } });
    return result;
  }

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "stay_extended",
    field: `#${r.id.slice(-6)} · ${stay.unit.label}`,
    oldValue: checkOut,
    newValue: `${newCheckOut} · ${nights.length} night(s) · ${(typed / 100).toFixed(2)} ${property.baseCurrency}` +
      (mode === "linked" ? ` · linked reservation #${result.reservationId.slice(-6)}` : ""),
    userId: session.userId,
  });
  await recordSync(session.activePropertyId, session.tenantId, `Availability reduced — ${stay.line.roomType.name}`,
    `Stay extended to ${newCheckOut}`, stayScope([{ roomTypeId: stay.line.roomTypeId, checkIn: from, checkOut: to }]));
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/folio/${r.id}`);
  revalidatePath(`/reservation/${r.id}`);
  return result;
}
