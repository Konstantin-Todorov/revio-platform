/**
 * The guest managing their own booking on RevioDirect — cancel it, or move its dates.
 *
 * Booking.com, Airbnb and every hotel chain let a guest do both without phoning anyone, and a
 * direct booking that cannot is a reason to book through the OTA next time. The rules here are the
 * hotel's own, applied exactly as staff would apply them:
 *
 *  - **Cancelling** follows the terms the guest agreed to (`stayTerms`, frozen at booking) through
 *    `settleOnline` — the same function RevioCRS's Cancel button calls — so a guest cancelling
 *    inside the free window gets their money back and one cancelling after it pays the fee they were
 *    shown, whoever pressed the button.
 *  - **Changing dates** keeps the room, the rate and the party, re-prices on the new nights and
 *    claims them atomically (`claimHold`) before anything is written. It is offered only while no
 *    money has been taken online: moving a paid stay means refunding or charging a difference, and
 *    that is a conversation with the hotel, not a button.
 *
 * Authority: a reference only SHOWS a booking (it is six characters, printed on paper and read out
 * on the phone). Changing one needs the `guestManageToken` sent in the confirmation email's link.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  claimHold, isStayInHouse, releaseRoomsForCancellation, withTenantTransaction, type forTenant,
} from "@revio/db";
import { withoutCard, type StayTerms } from "@revio/core";
import { recordAvailabilityPush, stayScope } from "@revio/connectivity";
import { publicChangeQuote, HOLD_MINUTES, type ChangeQuoteRefusal } from "./public-engine.js";
import { settleOnline, type SettledOnline } from "./settle-online.js";

type Db = ReturnType<typeof forTenant>;
type PropertyRow = { id: string; tenantId: string; name: string; baseCurrency: string; timezone: string; paymentReady?: boolean };

/** A fresh manage key: 24 random bytes, URL-safe. */
export function mintManageToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Constant-time: a token compared with `===` leaks how many leading characters were right. */
export function manageTokenMatches(stored: string | null | undefined, given: string | null | undefined): boolean {
  if (!stored || !given) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ChangeBlock = "paid_online" | "started" | "not_confirmed";

export interface ManageAbility {
  canCancel: boolean;
  canChange: boolean;
  /** Why dates cannot be moved here — the page says it and offers the hotel's phone instead. */
  changeBlock: ChangeBlock | null;
}

/**
 * What the guest may do with this booking today. Pure, so the page and the action agree.
 *
 * Cancelling is open until the arrival day itself (a same-day cancellation is still a cancellation;
 * the terms decide what it costs, and an arrived guest is refused separately by `isStayInHouse`).
 * Changing closes the day before arrival — a date change on the morning of arrival is a front-desk
 * matter — and whenever money has moved online.
 */
export function manageAbility(r: {
  status: string;
  checkIn: string;
  today: string;
  onlinePaidMinor: number | null;
  balanceChargedAt: Date | null;
  departedAt?: Date | null;
}): ManageAbility {
  const live = ["confirmed", "modified", "requested"].includes(r.status) && !r.departedAt;
  const canCancel = live && r.today <= r.checkIn;
  let changeBlock: ChangeBlock | null = null;
  if (!["confirmed", "modified"].includes(r.status)) changeBlock = "not_confirmed";
  else if (r.today >= r.checkIn) changeBlock = "started";
  else if ((r.onlinePaidMinor ?? 0) > 0 || r.balanceChargedAt) changeBlock = "paid_online";
  return { canCancel, canChange: live && changeBlock === null, changeBlock };
}

export type GuestCancelOutcome =
  | { ok: true; settled: SettledOnline | null }
  | { ok: false; code: "not_allowed" | "in_house" };

/** The guest cancels. The same event as a staff cancellation: one transaction, then the money. */
export async function guestCancelReservation(
  db: Db, property: PropertyRow, reservationId: string, today: string,
): Promise<GuestCancelOutcome> {
  const r = await db.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    select: {
      id: true, status: true, guestName: true, onlinePaidMinor: true, balanceChargedAt: true, departedAt: true,
      lines: { select: { roomTypeId: true, checkIn: true, checkOut: true } },
    },
  });
  const line = r?.lines[0];
  if (!r || !line) return { ok: false, code: "not_allowed" };
  const ability = manageAbility({ ...r, checkIn: line.checkIn.toISOString().slice(0, 10), today });
  if (!ability.canCancel) return { ok: false, code: "not_allowed" };
  if (await isStayInHouse(db, r.id)) return { ok: false, code: "in_house" };

  const cancelled = await withTenantTransaction(property.tenantId, async (tx) => {
    // Conditional on the status it was read in: a double-press, or staff cancelling in the same
    // second, matches nothing the second time — and must not settle money twice.
    const { count } = await tx.reservation.updateMany({
      where: { id: r.id, status: { in: ["confirmed", "modified", "requested"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    if (count !== 1) return false;
    await releaseRoomsForCancellation(tx, r.id);
    const folios = await tx.folio.findMany({
      where: { reservationId: r.id, status: "open" },
      include: { lines: { select: { id: true, voided: true } } },
    });
    for (const f of folios) {
      if (f.lines.some((l) => !l.voided)) continue;
      await tx.folio.update({ where: { id: f.id }, data: { status: "closed", closedAt: new Date(), outcome: "settled" } });
    }
    return true;
  });
  if (!cancelled) return { ok: false, code: "not_allowed" };

  // A request the hotel never accepted took no money; everything else settles by the agreed terms.
  const settled = await settleOnline(db, r.id, "cancel", today, false);
  await db.auditEntry.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id,
      entity: `Reservation #${r.id.slice(-6)} · ${r.guestName}`,
      field: "cancelled", oldValue: r.status, newValue: "cancelled by the guest (Booking Engine)",
      source: "api",
    },
  });
  await recordAvailabilityPush(db, {
    tenantId: property.tenantId,
    propertyId: property.id,
    summary: "Availability restored — cancelled by the guest (Booking Engine)",
    scope: stayScope([line]),
  });
  return { ok: true, settled };
}

export type ChangeRefusal = ChangeQuoteRefusal | "not_allowed" | "same_dates" | "needs_payment";

export interface ChangePreview {
  checkIn: string;
  checkOut: string;
  totalMinor: number;
  currency: string;
  terms: StayTerms | null;
}

/** What the loaded booking must carry for a change to be quoted or written. */
async function loadForChange(db: Db, property: PropertyRow, reservationId: string) {
  return db.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    select: {
      id: true, status: true, guestName: true, onlinePaidMinor: true, balanceChargedAt: true, departedAt: true,
      guaranteeRef: true, paymentCustomerId: true,
      lines: { select: { id: true, roomTypeId: true, ratePlanId: true, checkIn: true, checkOut: true, guestsCount: true, childAges: true } },
      stayExtras: { where: { active: true }, select: { priceMinor: true, basis: true } },
    },
  });
}

async function quoteChange(
  db: Db, property: PropertyRow, r: NonNullable<Awaited<ReturnType<typeof loadForChange>>>,
  checkIn: string, checkOut: string, today: string,
) {
  const line = r.lines[0];
  if (!line || !line.ratePlanId) return { ok: false as const, code: "not_allowed" as const };
  if (!manageAbility({ ...r, checkIn: line.checkIn.toISOString().slice(0, 10), today }).canChange) {
    return { ok: false as const, code: "not_allowed" as const };
  }
  if (checkIn <= today) return { ok: false as const, code: "invalid" as const };
  if (checkIn === line.checkIn.toISOString().slice(0, 10) && checkOut === line.checkOut.toISOString().slice(0, 10)) {
    return { ok: false as const, code: "same_dates" as const };
  }
  const q = await publicChangeQuote(db, property, {
    reservationId: r.id, roomTypeId: line.roomTypeId, ratePlanId: line.ratePlanId, guests: line.guestsCount ?? 2, childAges: line.childAges,
    checkIn, checkOut,
    extras: r.stayExtras.map((e) => ({ priceMinor: e.priceMinor, basis: e.basis === "per_stay" ? "per_stay" : "per_night" })),
  });
  if (!q.ok) return q;
  // A later charge needs a saved card; a booking that has none keeps "pay at the hotel".
  const hasCard = !!r.paymentCustomerId && !!r.guaranteeRef?.startsWith("pm_");
  const terms = q.terms && !hasCard ? withoutCard(q.terms) : q.terms;
  // Nothing was taken online (that is why a change is offered); a rate that now wants money up
  // front cannot be moved to without taking it, which is the hotel's call, not a button's.
  if ((terms?.payNowMinor ?? 0) > 0) return { ok: false as const, code: "needs_payment" as const };
  return { ...q, terms, line };
}

/** Price the new dates without writing anything — the "here is what changes" step. */
export async function guestPreviewChange(
  db: Db, property: PropertyRow, reservationId: string, checkIn: string, checkOut: string, today: string,
): Promise<{ ok: true; preview: ChangePreview } | { ok: false; code: ChangeRefusal }> {
  const r = await loadForChange(db, property, reservationId);
  if (!r) return { ok: false, code: "not_allowed" };
  const q = await quoteChange(db, property, r, checkIn, checkOut, today);
  if (!q.ok) return { ok: false, code: q.code };
  return { ok: true, preview: { checkIn, checkOut, totalMinor: q.totalMinor, currency: q.currency, terms: q.terms } };
}

/**
 * Move the stay. Re-quoted here — never trusting the preview the page showed — then the new nights
 * are CLAIMED before a row changes, so two guests moving onto the last room cannot both succeed.
 * `totalMinor` is what the guest confirmed; if the price moved in between, refuse rather than book
 * a number they did not see.
 */
export async function guestChangeDates(
  db: Db, property: PropertyRow, reservationId: string,
  p: { checkIn: string; checkOut: string; expectedTotalMinor: number; today: string },
): Promise<{ ok: true; preview: ChangePreview } | { ok: false; code: ChangeRefusal | "price_changed" }> {
  const r = await loadForChange(db, property, reservationId);
  if (!r) return { ok: false, code: "not_allowed" };
  const q = await quoteChange(db, property, r, p.checkIn, p.checkOut, p.today);
  if (!q.ok) return { ok: false, code: q.code };
  if (q.totalMinor !== p.expectedTotalMinor) return { ok: false, code: "price_changed" };

  const claim = await claimHold({
    tenantId: property.tenantId,
    propertyId: property.id,
    roomTypeId: q.line.roomTypeId,
    quantity: 1,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
    source: "booking_engine",
    sellableByNight: q.sellableByNight,
    excludeReservationId: r.id,
  });
  if (!claim.ok) return { ok: false, code: "sold_out" };

  const utc = (d: string) => new Date(`${d}T00:00:00Z`);
  const moved = await withTenantTransaction(property.tenantId, async (tx) => {
    const { count } = await tx.reservation.updateMany({
      where: { id: r.id, status: { in: ["confirmed", "modified"] } },
      data: {
        status: "modified",
        totalMinor: q.accommodationMinor,
        propertyTotalMinor: q.accommodationMinor,
        ...(q.terms ? { stayTerms: q.terms as unknown as object } : {}),
        balanceChargeMinor: q.terms?.scheduled?.amountMinor ?? null,
        balanceChargeOn: q.terms?.scheduled ? utc(q.terms.scheduled.on) : null,
      },
    });
    if (count !== 1) return false;
    await tx.reservationLine.update({
      where: { id: q.line.id },
      data: { checkIn: utc(p.checkIn), checkOut: utc(p.checkOut), priceMinor: q.accommodationMinor },
    });
    // The per-night snapshot the folio bills from: the old nights are no longer this stay's.
    await tx.reservationNightRate.deleteMany({ where: { reservationLineId: q.line.id } });
    await tx.reservationNightRate.createMany({
      data: q.nights.map((n) => ({
        tenantId: property.tenantId, reservationLineId: q.line.id,
        date: utc(n.date), occupancy: n.occupancy, rateMinor: n.rateMinor, source: "booking",
      })),
    });
    await tx.hold.updateMany({ where: { id: claim.holdId, status: "active" }, data: { status: "converted", reservationId: r.id } });
    return true;
  });
  if (!moved) {
    await db.hold.updateMany({ where: { id: claim.holdId, status: "active" }, data: { status: "released" } });
    return { ok: false, code: "not_allowed" };
  }

  const was = `${q.line.checkIn.toISOString().slice(0, 10)} → ${q.line.checkOut.toISOString().slice(0, 10)}`;
  await db.auditEntry.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id,
      entity: `Reservation #${r.id.slice(-6)} · ${r.guestName}`,
      field: "modified", oldValue: was, newValue: `${p.checkIn} → ${p.checkOut} (changed by the guest, Booking Engine)`,
      source: "api",
    },
  });
  // Both stays: the nights now taken, and the ones given back to sell.
  await recordAvailabilityPush(db, {
    tenantId: property.tenantId,
    propertyId: property.id,
    summary: "Availability updated — dates changed by the guest (Booking Engine)",
    scope: stayScope([
      { roomTypeId: q.line.roomTypeId, checkIn: q.line.checkIn, checkOut: q.line.checkOut },
      { roomTypeId: q.line.roomTypeId, checkIn: p.checkIn, checkOut: p.checkOut },
    ]),
  });
  return { ok: true, preview: { checkIn: p.checkIn, checkOut: p.checkOut, totalMinor: q.totalMinor, currency: q.currency, terms: q.terms } };
}

/**
 * Undo the rooms already written when a later room of the same booking could not be — the guest is
 * told nothing was booked, so nothing may stay booked. Cancelled (never deleted, the audit keeps
 * them), rooms released, availability pushed back. No money moves: the payment is only captured
 * after EVERY room exists, and the caller releases the authorisation.
 */
export async function voidGroupReservations(db: Db, property: PropertyRow, reservationIds: string[]): Promise<void> {
  if (reservationIds.length === 0) return;
  const lines = await db.reservationLine.findMany({
    where: { reservationId: { in: reservationIds } },
    select: { roomTypeId: true, checkIn: true, checkOut: true },
  });
  await withTenantTransaction(property.tenantId, async (tx) => {
    await tx.reservation.updateMany({
      where: { id: { in: reservationIds }, propertyId: property.id },
      data: { status: "cancelled", cancelledAt: new Date(), onlinePaidMinor: 0 },
    });
    for (const id of reservationIds) await releaseRoomsForCancellation(tx, id);
  });
  await recordAvailabilityPush(db, {
    tenantId: property.tenantId,
    propertyId: property.id,
    summary: "Availability restored — a multi-room booking could not be completed (Booking Engine)",
    scope: stayScope(lines),
  });
}
