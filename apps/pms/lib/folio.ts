import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ymd } from "./format";

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
    await prisma.folioLine.create({
      data: { ...base, kind: "accommodation", description: `${line.roomType.name} · ${ymd(line.checkIn)}→${ymd(line.checkOut)}`, amountMinor: price },
    });
  }

  const fees = await prisma.taxFee.findMany({ where: { propertyId, active: true, inclusion: "excluded" } });
  for (const f of fees) {
    const amt = feeAmount(f, accomTotal, nights, rooms, guests);
    if (amt > 0) await prisma.folioLine.create({ data: { ...base, kind: f.type === "percent" ? "tax" : "fee", description: f.name, amountMinor: amt } });
  }

  if (reservation.paymentGuarantee === "prepaid_ota") {
    const charges = (await prisma.folioLine.findMany({ where: { folioId, voided: false, kind: { not: "payment" } }, select: { amountMinor: true } })).reduce((s, l) => s + l.amountMinor, 0);
    if (charges > 0) await prisma.folioLine.create({ data: { ...base, kind: "payment", description: "Prepaid via OTA", amountMinor: charges, method: "prepaid_ota" } });
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
