import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ymd } from "./format";

/**
 * The PMS operational guest profile (spec §3.3) — the richer view the CRS deliberately is NOT.
 * Everything here is derived from OPERATIONAL history (folios, POS consumption, room assignments),
 * which is exactly the data the PMS owns. Guests are keyed by their Guest record when one exists,
 * else by name (channel imports carry a guestName but no Guest row) so repeat behaviour still shows.
 */

const STAY_STATUSES = ["confirmed", "modified", "checked_in", "checked_out"];
const nightsOf = (lines: { checkIn: Date; checkOut: Date; quantity: number }[]) =>
  lines.reduce((n, l) => n + Math.max(1, Math.round((l.checkOut.getTime() - l.checkIn.getTime()) / 86_400_000)) * l.quantity, 0);
const ancillaryOf = (folioLines: { kind: string; amountMinor: number; voided: boolean }[]) =>
  folioLines.filter((l) => !l.voided && (l.kind === "minibar" || l.kind === "extra")).reduce((s, l) => s + l.amountMinor, 0);

const keyFor = (r: { guestId: string | null; guestName: string }) => r.guestId ?? `name~${r.guestName}`;

export async function getPmsGuests() {
  const { property } = await activeProperty();
  const reservations = await prisma.reservation.findMany({
    where: { propertyId: property.id, status: { in: STAY_STATUSES } },
    include: { lines: true, folios: { include: { lines: true } }, guest: { select: { firstName: true, lastName: true, email: true } } },
  });

  const byGuest = new Map<string, { key: string; name: string; guestId: string | null; email: string | null; stays: number; nights: number; ancillaryMinor: number; lifetimeMinor: number; lastStay: string | null }>();
  for (const r of reservations) {
    if (r.lines.length === 0) continue;
    const key = keyFor(r);
    const name = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const row = byGuest.get(key) ?? { key, name, guestId: r.guestId, email: r.guest?.email ?? null, stays: 0, nights: 0, ancillaryMinor: 0, lifetimeMinor: 0, lastStay: null };
    row.stays += 1;
    row.nights += nightsOf(r.lines);
    row.ancillaryMinor += ancillaryOf(r.folios.flatMap((f) => f.lines));
    row.lifetimeMinor += r.propertyTotalMinor ?? r.totalMinor;
    const co = r.lines.map((l) => ymd(l.checkOut)).sort().at(-1)!;
    if (!row.lastStay || co > row.lastStay) row.lastStay = co;
    byGuest.set(key, row);
  }
  const rows = [...byGuest.values()].sort((a, b) => b.stays - a.stays || (b.lastStay ?? "").localeCompare(a.lastStay ?? ""));
  return { property, rows };
}

export async function getPmsGuestProfile(key: string) {
  const { property } = await activeProperty();
  const isName = key.startsWith("name~");
  const where = isName
    ? { propertyId: property.id, guestId: null, guestName: key.slice(5) }
    : { propertyId: property.id, guestId: key };

  const [guest, reservations] = await Promise.all([
    isName ? Promise.resolve(null) : prisma.guest.findFirst({ where: { id: key, propertyId: property.id } }),
    prisma.reservation.findMany({
      where,
      include: {
        lines: { include: { roomType: { select: { name: true } } } },
        folios: { include: { lines: true } },
        assignments: { include: { unit: { select: { label: true, floor: true } } } },
        channel: { select: { name: true } },
        bookingSource: { select: { name: true } },
      },
      orderBy: { importedAt: "desc" },
    }),
  ]);
  if (reservations.length === 0 && !guest) return null;

  const name = guest ? `${guest.firstName} ${guest.lastName}`.trim() : (isName ? key.slice(5) : reservations[0]?.guestName ?? "Guest");
  const stays = reservations.filter((r) => STAY_STATUSES.includes(r.status));
  const nights = stays.reduce((n, r) => n + nightsOf(r.lines), 0);
  const accommodationMinor = stays.reduce((s, r) => s + (r.propertyTotalMinor ?? r.totalMinor), 0);

  // Ancillary / POS consumption across every folio → spend + favourite items.
  const folioLines = reservations.flatMap((r) => r.folios.flatMap((f) => f.lines));
  const ancillaryMinor = ancillaryOf(folioLines);
  const itemAgg = new Map<string, { count: number; amountMinor: number }>();
  for (const l of folioLines) {
    if (l.voided || (l.kind !== "minibar" && l.kind !== "extra")) continue;
    const e = itemAgg.get(l.description) ?? { count: 0, amountMinor: 0 };
    e.count += 1; e.amountMinor += l.amountMinor;
    itemAgg.set(l.description, e);
  }
  const favouriteItems = [...itemAgg.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || b.amountMinor - a.amountMinor).slice(0, 5);

  // Preferred room / floor from assignment history.
  const roomAgg = new Map<string, number>();
  const floorAgg = new Map<string, number>();
  for (const r of reservations) for (const a of r.assignments) {
    roomAgg.set(a.unit.label, (roomAgg.get(a.unit.label) ?? 0) + 1);
    if (a.unit.floor) floorAgg.set(a.unit.floor, (floorAgg.get(a.unit.floor) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Requests & notes (the honest stand-in for a structured complaint log — that's future).
  const notes: string[] = [];
  if (guest?.specialRequests) notes.push(guest.specialRequests);
  for (const r of reservations) if (r.notes) notes.push(r.notes);

  return {
    property,
    key,
    guest: {
      name,
      email: guest?.email ?? null,
      phone: guest?.phone ?? null,
      company: guest?.company ?? null,
    },
    stats: {
      stays: stays.length,
      nights,
      lifetimeMinor: accommodationMinor + ancillaryMinor,
      accommodationMinor,
      ancillaryMinor,
      avgNightlyMinor: nights > 0 ? Math.round(accommodationMinor / nights) : 0,
      avgAncillaryPerStayMinor: stays.length > 0 ? Math.round(ancillaryMinor / stays.length) : 0,
      preferredRoom: top(roomAgg),
      preferredFloor: top(floorAgg),
    },
    favouriteItems,
    notes: [...new Set(notes)],
    reservations: reservations.map((r) => ({
      id: r.id,
      status: r.status,
      source: r.channel?.name ?? r.bookingSource?.name ?? "Direct",
      roomType: r.lines[0]?.roomType.name ?? "—",
      checkIn: r.lines[0] ? ymd(r.lines[0].checkIn) : null,
      checkOut: r.lines[0] ? ymd(r.lines[0].checkOut) : null,
      totalMinor: r.propertyTotalMinor ?? r.totalMinor,
      currency: r.propertyCurrency ?? r.currency,
    })),
  };
}
