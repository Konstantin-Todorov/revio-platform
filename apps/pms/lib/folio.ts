import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { postFolioLine } from "./posting";
import { ymd, todayInTz } from "./format";
import type { HkStatus } from "./hk-meta";

export type FolioLineRow = {
  id: string; kind: string; description: string; amountMinor: number;
  method: string | null; ref: string | null; voided: boolean; postedAt: Date;
};

/** Balance = Σ(non-voided charges) − Σ(non-voided payments). Charges are every non-payment kind. */
export function folioBalance(lines: { kind: string; amountMinor: number; voided: boolean }[]) {
  let charges = 0, payments = 0;
  for (const l of lines) {
    if (l.voided) continue;
    if (l.kind === "payment") payments += l.amountMinor;
    else charges += l.amountMinor;
  }
  return { charges, payments, balance: charges - payments };
}

/** Fee/tax amount for a TaxFee against a stay (percent = % of accommodation; fixed × basis multiplier). */
function feeAmount(f: { type: string; pct: number | null; amountMinor: number | null; basis: string }, subtotal: number, nights: number, rooms: number, guests: number): number {
  if (f.type === "percent") return f.pct ? Math.round((subtotal * f.pct) / 100) : 0;
  const unit = f.amountMinor ?? 0;
  const mult = f.basis === "per_night" ? nights : f.basis === "per_room" ? rooms : f.basis === "per_person" ? guests : 1;
  return unit * mult;
}

/**
 * Ensure a stay has a folio, creating + seeding it on first use (accommodation from the reservation
 * rate, excluded taxes/fees, and — for OTA-prepaid bookings — an auto payment that zeroes the balance).
 * Idempotent + race-safe via the unique reservationId. Called at check-in / walk-in and lazily on the
 * folio page (for stays checked in before Phase 3).
 */
export async function ensureFolio(tenantId: string, propertyId: string, reservationId: string): Promise<string | null> {
  const existing = await prisma.folio.findUnique({ where: { reservationId }, select: { id: true } });
  if (existing) return existing.id;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId },
    include: { lines: { include: { roomType: { select: { name: true } } } } },
  });
  if (!reservation) return null;

  const currency = reservation.currency || "EUR";
  let folioId: string;
  try {
    const created = await prisma.folio.create({ data: { tenantId, propertyId, reservationId, currency }, select: { id: true } });
    folioId = created.id;
  } catch {
    // Lost a create race — the other request seeded it.
    const again = await prisma.folio.findUnique({ where: { reservationId }, select: { id: true } });
    return again?.id ?? null;
  }

  const base = { tenantId, propertyId, folioId };
  let accomTotal = 0;
  let nights = 1, rooms = 0, guests = 0;
  const cis = reservation.lines.map((l) => l.checkIn.getTime());
  const cos = reservation.lines.map((l) => l.checkOut.getTime());
  if (cis.length) nights = Math.max(1, Math.round((Math.max(...cos) - Math.min(...cis)) / 86_400_000));

  for (const line of reservation.lines) {
    const price = line.priceMinor ?? 0;
    accomTotal += price;
    rooms += line.quantity;
    guests += line.guestsCount ?? line.quantity;
    // Seed accommodation via the charge-posting service too — no direct FolioLine writes (spec §1.7).
    await postFolioLine({ ...base, kind: "accommodation", description: `${line.roomType.name} · ${ymd(line.checkIn)}→${ymd(line.checkOut)}`, amountMinor: price });
  }

  const fees = await prisma.taxFee.findMany({ where: { propertyId, active: true, inclusion: "excluded" } });
  for (const f of fees) {
    const amt = feeAmount(f, accomTotal, nights, rooms, guests);
    if (amt > 0) await postFolioLine({ ...base, kind: f.type === "percent" ? "tax" : "fee", description: f.name, amountMinor: amt });
  }

  if (reservation.paymentGuarantee === "prepaid_ota") {
    const charges = (await prisma.folioLine.findMany({ where: { folioId, voided: false, kind: { not: "payment" } }, select: { amountMinor: true } })).reduce((s, l) => s + l.amountMinor, 0);
    if (charges > 0) await postFolioLine({ ...base, kind: "payment", description: "Prepaid via OTA", amountMinor: charges, method: "prepaid_ota" });
  }
  return folioId;
}

/** The folio view for /folio/[reservationId]: ensures the folio exists, returns reservation + lines + balance. */
export async function getFolioView(reservationId: string) {
  const { session, property } = await activeProperty();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: { guest: true, lines: { include: { roomType: { select: { name: true } } } }, assignments: { where: { status: "active", checkedOutAt: null }, include: { unit: { select: { label: true } } } } },
  });
  if (!reservation) return null;

  await ensureFolio(session.tenantId, property.id, reservationId);
  const folio = await prisma.folio.findUnique({ where: { reservationId }, include: { lines: { orderBy: { postedAt: "asc" } } } });
  if (!folio) return null;

  return { property, reservation, folio, totals: folioBalance(folio.lines) };
}

export interface TimelineEvent { at: Date; label: string; detail?: string; kind: "booking" | "assigned" | "moved" | "checkin" | "checkout" | "charge" | "payment" | "cancel" }
export type StayState = "booked" | "assigned" | "in_house" | "departed" | "cancelled";

/**
 * The unified Reservation view (spec §3.2) — one record, two phases. Three zones from a single shared
 * reservation: the COMMERCIAL origin (read-only, written by the CRS/channel), the OPERATIONAL state
 * (PMS-owned: room, stay state, folio, housekeeping), and the TIMELINE (history of the stay). No
 * side effects — the folio is only read, never seeded here (that stays with the folio screen).
 */
export async function getReservationDetail(reservationId: string) {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const r = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: {
      guest: true,
      channel: { select: { name: true } },
      bookingSource: { select: { name: true } },
      lines: { include: { roomType: { select: { name: true } }, ratePlan: { select: { name: true, cancellationPolicy: { select: { name: true } }, mealPlan: { select: { name: true } } } } } },
      assignments: { include: { unit: { select: { label: true, floor: true, hkStatus: true } } }, orderBy: { createdAt: "asc" } },
      folio: { include: { lines: { orderBy: { postedAt: "asc" } } } },
    },
  });
  if (!r) return null;

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const nights = ci && co ? Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86_400_000)) : 0;
  const rooms = r.lines.reduce((n, l) => n + l.quantity, 0);
  const guests = r.lines.reduce((n, l) => n + (l.guestsCount ?? 0), 0);

  const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
  const assignedUnits = active.map((a) => ({ label: a.unit.label, floor: a.unit.floor, hkStatus: a.unit.hkStatus as HkStatus }));
  const checkedIn = active.some((a) => a.checkedInAt != null);
  const departedToday = r.assignments.some((a) => a.checkedOutAt != null && ymd(a.checkedOutAt) === today);
  const stayState: StayState =
    r.status === "cancelled" ? "cancelled"
      : checkedIn ? "in_house"
      : active.length > 0 ? "assigned"
      : departedToday ? "departed"
      : "booked";

  const balance = r.folio ? folioBalance(r.folio.lines) : null;

  // Timeline — booking → assigned → checked in → moved → charges → checked out (spec §3.2).
  const events: TimelineEvent[] = [
    { at: r.importedAt, label: "Booking received", detail: `${r.channel?.name ?? r.bookingSource?.name ?? "Direct"}${r.externalId ? ` · #${r.externalId}` : ""}`, kind: "booking" },
  ];
  for (const a of r.assignments) {
    const moved = a.note?.startsWith("moved from") ?? false;
    events.push({ at: a.createdAt, label: moved ? `Moved to room ${a.unit.label}` : `Room ${a.unit.label} assigned`, detail: a.note ?? undefined, kind: moved ? "moved" : "assigned" });
    if (a.checkedInAt) events.push({ at: a.checkedInAt, label: `Checked in — room ${a.unit.label}`, kind: "checkin" });
    if (a.checkedOutAt) events.push({ at: a.checkedOutAt, label: `Checked out — room ${a.unit.label}`, kind: "checkout" });
  }
  for (const l of r.folio?.lines ?? []) {
    if (l.voided) continue;
    events.push({ at: l.postedAt, label: l.kind === "payment" ? "Payment recorded" : "Charge posted", detail: l.description, kind: l.kind === "payment" ? "payment" : "charge" });
  }
  if (r.cancelledAt) events.push({ at: r.cancelledAt, label: "Cancelled", kind: "cancel" });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    property,
    reservationId: r.id,
    guestName,
    status: r.status,
    commercial: {
      source: r.channel?.name ?? r.bookingSource?.name ?? "Direct",
      externalId: r.externalId,
      ratePlans: [...new Set(r.lines.map((l) => l.ratePlan.name))],
      roomTypes: [...new Set(r.lines.map((l) => l.roomType.name))],
      mealPlan: r.lines.map((l) => l.ratePlan.mealPlan?.name).find(Boolean) ?? null,
      cancellation: r.lines.map((l) => l.ratePlan.cancellationPolicy?.name).find(Boolean) ?? null,
      paymentGuarantee: r.paymentGuarantee,
      totalMinor: r.propertyTotalMinor ?? r.totalMinor,
      currency: r.propertyCurrency ?? r.currency,
      checkIn: ci ? ymd(ci) : null,
      checkOut: co ? ymd(co) : null,
      nights, rooms, guests,
      notes: r.notes,
    },
    operational: {
      stayState,
      dueOut: co ? ymd(co) === today : false,
      assignedUnits,
      folioId: r.folio?.id ?? null,
      balance,
      currency: r.folio?.currency ?? r.currency,
    },
    events,
  };
}

/** In-house stays with their folio balance, for the /folios list. */
export async function listFolios() {
  const { property } = await activeProperty();
  const assignments = await prisma.roomAssignment.findMany({
    where: { propertyId: property.id, status: "active", checkedOutAt: null },
    include: { reservation: { include: { guest: true, folio: { include: { lines: true } } } }, unit: { select: { label: true } } },
    orderBy: { checkedInAt: "desc" },
  });

  const byRes = new Map<string, { reservationId: string; guestName: string; units: string[]; balance: number | null; currency: string }>();
  for (const a of assignments) {
    const r = a.reservation;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const row = byRes.get(r.id) ?? {
      reservationId: r.id, guestName, units: [],
      balance: r.folio ? folioBalance(r.folio.lines).balance : null,
      currency: r.folio?.currency ?? r.currency ?? property.baseCurrency,
    };
    row.units.push(a.unit.label);
    byRes.set(r.id, row);
  }
  return { property, rows: [...byRes.values()] };
}
