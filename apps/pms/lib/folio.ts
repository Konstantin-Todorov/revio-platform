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

/**
 * Balance = Σ(non-voided charges) − Σ(non-voided payments).
 *
 * DEPOSITS ARE A LIABILITY, not revenue and not an ordinary payment (spec §4.4) — booking one as
 * either breaks both night-audit revenue and the folio balance. So a HELD deposit sits in its own
 * bucket, outside charges AND payments:
 *   deposit_held    → money held that may be returned (liability+)
 *   deposit_refund  → held money returned to the guest (liability−)
 *   deposit_use     → held money APPLIED to the bill — only now does it count as a payment
 * An APPLIED-behaviour deposit never uses these kinds: it's captured straight as a `payment`.
 */
export function folioBalance(lines: { kind: string; amountMinor: number; voided: boolean }[]) {
  let charges = 0, payments = 0, depositsHeld = 0;
  for (const l of lines) {
    if (l.voided) continue;
    switch (l.kind) {
      case "payment": payments += l.amountMinor; break;
      case "deposit_held": depositsHeld += l.amountMinor; break;
      case "deposit_refund": depositsHeld -= l.amountMinor; break;
      case "deposit_use": depositsHeld -= l.amountMinor; payments += l.amountMinor; break;
      default: charges += l.amountMinor;
    }
  }
  return { charges, payments, balance: charges - payments, depositsHeld };
}

/** The property's city-tax fee, by name — the one fee the CRS's cityTaxMode can suppress. */
export function isCityTax(name: string): boolean {
  return /city\s*tax/i.test(name);
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
  // The PRIMARY (guest) folio; split/company folios (spec §3.6) are added on top and never seeded here.
  const existing = await prisma.folio.findFirst({ where: { reservationId, isPrimary: true }, select: { id: true } });
  if (existing) return existing.id;

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId },
    include: { lines: { include: { roomType: { select: { name: true } } } } },
  });
  if (!reservation) return null;

  const currency = reservation.currency || "EUR";
  const created = await prisma.folio.create({ data: { tenantId, propertyId, reservationId, currency, isPrimary: true, label: "Guest" }, select: { id: true } });
  const folioId = created.id;

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

  // CITY-TAX SUPPRESSION (spec §3.6): the CRS decides whether city tax is payable on spot or already
  // included in the rate. When it's "included", the PMS must NOT post the Fee line — the guest has
  // already paid it in the rate, and posting it here would double-charge. Both CRS modes are honoured.
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId }, select: { cityTaxMode: true } });
  const cityTaxIncluded = defaults?.cityTaxMode === "included";

  const fees = await prisma.taxFee.findMany({ where: { propertyId, active: true, inclusion: "excluded" } });
  for (const f of fees) {
    if (cityTaxIncluded && isCityTax(f.name)) continue;
    const amt = feeAmount(f, accomTotal, nights, rooms, guests);
    if (amt > 0) await postFolioLine({ ...base, kind: f.type === "percent" ? "tax" : "fee", description: f.name, amountMinor: amt });
  }

  if (reservation.paymentGuarantee === "prepaid_ota") {
    const charges = (await prisma.folioLine.findMany({ where: { folioId, voided: false, kind: { not: "payment" } }, select: { amountMinor: true } })).reduce((s, l) => s + l.amountMinor, 0);
    if (charges > 0) await postFolioLine({ ...base, kind: "payment", description: "Prepaid via OTA", amountMinor: charges, method: "prepaid_ota" });
  }
  return folioId;
}

/** The folio view for /folio/[reservationId]: ensures the primary folio exists, returns reservation +
 * EVERY folio for the stay (primary + split/company) with per-folio and combined balance (spec §3.6). */
export async function getFolioView(reservationId: string) {
  const { session, property } = await activeProperty();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: { guest: true, lines: { include: { roomType: { select: { name: true } } } }, assignments: { where: { status: "active", checkedOutAt: null }, include: { unit: { select: { label: true } } } } },
  });
  if (!reservation) return null;

  await ensureFolio(session.tenantId, property.id, reservationId);
  const folioRows = await prisma.folio.findMany({
    where: { reservationId },
    orderBy: [{ isPrimary: "desc" }, { openedAt: "asc" }],
    include: { lines: { orderBy: { postedAt: "asc" } } },
  });
  if (folioRows.length === 0) return null;

  const folios = folioRows.map((f) => ({ ...f, totals: folioBalance(f.lines) }));
  const currency = folios[0]!.currency;
  const combined = folios.reduce(
    (s, f) => ({
      charges: s.charges + f.totals.charges,
      payments: s.payments + f.totals.payments,
      balance: s.balance + f.totals.balance,
      depositsHeld: s.depositsHeld + f.totals.depositsHeld,
    }),
    { charges: 0, payments: 0, balance: 0, depositsHeld: 0 },
  );
  // Any other open folio of THIS stay a line could be moved to.
  const moveTargets = folios.map((f) => ({ id: f.id, label: f.label }));
  const [depositTypes, stayExtras] = await Promise.all([
    prisma.depositType.findMany({ where: { propertyId: property.id, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.stayExtra.findMany({ where: { reservationId, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return { property, reservation, folios, currency, combined, moveTargets, depositTypes, stayExtras };
}

/** Combined balance across all a reservation's folios — the true amount owed at check-out. */
export async function reservationBalance(reservationId: string): Promise<number> {
  const folios = await prisma.folio.findMany({ where: { reservationId }, include: { lines: { select: { kind: true, amountMinor: true, voided: true } } } });
  return folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0);
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
      folios: { include: { lines: { orderBy: { postedAt: "asc" } } }, orderBy: [{ isPrimary: "desc" }, { openedAt: "asc" }] },
    },
  });
  if (!r) return null;
  const primaryFolio = r.folios.find((f) => f.isPrimary) ?? r.folios[0] ?? null;
  const allFolioLines = r.folios.flatMap((f) => f.lines);

  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const ci = r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const co = r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const nights = ci && co ? Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86_400_000)) : 0;
  const rooms = r.lines.reduce((n, l) => n + l.quantity, 0);
  const guests = r.lines.reduce((n, l) => n + (l.guestsCount ?? 0), 0);

  const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);
  const assignedUnits = active.map((a) => ({ assignmentId: a.id, label: a.unit.label, floor: a.unit.floor, hkStatus: a.unit.hkStatus as HkStatus }));
  const checkedIn = active.some((a) => a.checkedInAt != null);
  const departedToday = r.assignments.some((a) => a.checkedOutAt != null && ymd(a.checkedOutAt) === today);
  const stayState: StayState =
    r.status === "cancelled" ? "cancelled"
      : checkedIn ? "in_house"
      : active.length > 0 ? "assigned"
      : departedToday ? "departed"
      : "booked";

  const balance = r.folios.length > 0 ? folioBalance(allFolioLines) : null;

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
  for (const l of allFolioLines) {
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
      folioId: primaryFolio?.id ?? null,
      folioCount: r.folios.length,
      balance,
      currency: primaryFolio?.currency ?? r.currency,
    },
    events,
  };
}

/** In-house stays with their folio balance, for the /folios list. */
export async function listFolios() {
  const { property } = await activeProperty();
  const assignments = await prisma.roomAssignment.findMany({
    where: { propertyId: property.id, status: "active", checkedOutAt: null },
    include: { reservation: { include: { guest: true, folios: { include: { lines: true } } } }, unit: { select: { label: true } } },
    orderBy: { checkedInAt: "desc" },
  });

  const byRes = new Map<string, { reservationId: string; guestName: string; units: string[]; balance: number | null; currency: string; folioCount: number }>();
  for (const a of assignments) {
    const r = a.reservation;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const balance = r.folios.length > 0 ? r.folios.reduce((s, f) => s + folioBalance(f.lines).balance, 0) : null;
    const row = byRes.get(r.id) ?? {
      reservationId: r.id, guestName, units: [],
      balance,
      currency: r.folios[0]?.currency ?? r.currency ?? property.baseCurrency,
      folioCount: r.folios.length,
    };
    row.units.push(a.unit.label);
    byRes.set(r.id, row);
  }
  return { property, rows: [...byRes.values()] };
}

/**
 * Accrue every in-house stay's recurring extras for one night (spec §3.6) — "breakfast for the whole
 * stay" posts one folio line per night at the night audit, separate from one-off POS. IDEMPOTENT: each
 * line carries ref `stayextra:<id>:<date>`, so re-running Close Day never double-charges a night.
 * Returns how many lines were posted.
 */
export async function accrueStayExtras(tenantId: string, propertyId: string, businessDate: string): Promise<number> {
  const inHouse = await prisma.roomAssignment.findMany({
    where: { propertyId, status: "active", checkedOutAt: null, checkedInAt: { not: null } },
    select: { reservationId: true },
  });
  const reservationIds = [...new Set(inHouse.map((a) => a.reservationId))];
  if (reservationIds.length === 0) return 0;

  const extras = await prisma.stayExtra.findMany({ where: { propertyId, active: true, reservationId: { in: reservationIds } } });
  let posted = 0;
  for (const e of extras) {
    const ref = `stayextra:${e.id}:${businessDate}`;
    if (await prisma.folioLine.findFirst({ where: { ref }, select: { id: true } })) continue; // already accrued
    const folioId = await ensureFolio(tenantId, propertyId, e.reservationId);
    if (!folioId) continue;
    await postFolioLine({
      tenantId, propertyId, folioId, kind: "extra", outlet: "extra",
      description: `${e.name} · ${businessDate}`, amountMinor: e.priceMinor, ref,
    });
    posted++;
  }
  return posted;
}

/** Add a labelled split/company folio to a stay (spec §3.6). */
export async function createSplitFolio(tenantId: string, propertyId: string, reservationId: string, label: string): Promise<string | null> {
  const primary = await prisma.folio.findFirst({ where: { reservationId, propertyId }, select: { currency: true } });
  if (!primary) return null;
  const f = await prisma.folio.create({ data: { tenantId, propertyId, reservationId, currency: primary.currency, isPrimary: false, label: label || "Split" }, select: { id: true } });
  return f.id;
}
