"use server";

import { isSearchable, roleCanOpenProduct, type SearchHit } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";

/**
 * What ⌘K finds in RevioCRS.
 *
 * ## ⚠️ Every property the account holds, not just the active one
 *
 * The founder's decision, and it is the same one RevioLink's palette implements: *"if the thing is
 * in another property you do not find it and you do not understand why."* A chain switches property
 * to work, not to search. `context` carries the property name so two identically named rooms are
 * never confused, and the palette draws it only when the account has more than one property.
 *
 * ⚠️ **This is deliberately wider than `globalSearch`**, which is scoped to the active property and
 * sits behind `/search`. They are being brought into line; until they are, the palette is the wider
 * of the two, never the narrower — a fast path that finds LESS than the page it links to would be
 * the worse failure.
 *
 * ## What RevioCRS searches that RevioLink does not
 *
 * A guest. RevioLink only ever sees the name a channel sent; the CRS owns the guest record, so an
 * email or a phone number finds a person here and a booking there. That is the difference between
 * the two products in one query.
 *
 * ## Why a server action and not an API route
 *
 * It runs on every keystroke and needs the session; a route would need its own auth. No `guard`
 * call, deliberately — this READS what the person can already open and writes nothing.
 */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  if (!isSearchable(query)) return [];
  const session = await getSession();
  if (!session) return [];

  /*
   * ⚠️ The role gate, before a single row is read.
   *
   * The layout refuses this role the whole product (`roleCanOpenProduct`), but a server action is a
   * POST endpoint that Next runs BEFORE any layout re-renders — the same reason every write in this
   * app gates inside the action rather than behind a hidden button. Without this line a housekeeper's
   * session could call this action directly and read every guest and every rate in the hotel, with
   * the screens she cannot open never involved.
   */
  if (!roleCanOpenProduct(session.role, "crs")) return [];

  const term = query.trim();
  const tenantId = session.tenantId;
  const where = { property: { tenantId } };
  const take = 6;
  const like = { contains: term, mode: "insensitive" as const };

  const [reservations, guests, roomTypes, ratePlans, properties] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        ...where,
        OR: [
          { guestName: like },
          { externalId: like },
          { guest: { email: like } },
          { guest: { phone: { contains: term } } },
          { guest: { company: like } },
        ],
      },
      select: {
        id: true, guestName: true, externalId: true, status: true, importedAt: true,
        propertyId: true,
        property: { select: { name: true } },
        lines: { select: { checkIn: true, checkOut: true }, orderBy: { checkIn: "asc" }, take: 1 },
      },
      orderBy: { importedAt: "desc" },
      take,
    }),
    prisma.guest.findMany({
      where: {
        ...where,
        OR: [{ firstName: like }, { lastName: like }, { email: like }, { phone: { contains: term } }, { company: like }],
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, emailIsOtaAlias: true, phone: true,
        propertyId: true,
        property: { select: { name: true } },
      },
      take,
    }),
    prisma.roomType.findMany({
      where: { ...where, name: like },
      select: { id: true, name: true, code: true, totalRooms: true, propertyId: true, property: { select: { name: true } } },
      take,
    }),
    prisma.ratePlan.findMany({
      where: { ...where, name: like },
      select: { id: true, name: true, code: true, active: true, propertyId: true, property: { select: { name: true } } },
      take,
    }),
    prisma.property.findMany({
      where: { tenantId, name: like },
      select: { id: true, name: true, timezone: true },
      take: 4,
    }),
  ]);

  // Only name the property when there is more than one to confuse it with.
  const multi = session.propertyCount > 1;
  /* ⚠️ The id travels with the name — `context` says WHICH hotel a row is in, and the id is what
     makes the click work, because every screen this links to is scoped to the active property.
     Kept in one expression so a new hit kind cannot pick up one without the other. */
  const ctx = (id: string, name: string) => (multi ? { context: name, propertyId: id } : { propertyId: id });
  const day = (d: Date) => d.toISOString().slice(0, 10);

  return [
    ...reservations.map((r): SearchHit => {
      /* ⚠️ The STAY dates, not `importedAt`. RevioLink asks "when did this arrive from the channel";
         the CRS is the system of record and its question is "when are they here". The nights live on
         the lines, so the first line's check-in is the stay's start. */
      const line = r.lines[0];
      return {
        id: r.id,
        kind: "reservation",
        title: r.guestName || r.externalId || "Reservation",
        subtitle: line
          ? `${day(line.checkIn)} → ${day(line.checkOut)} · ${r.status}`
          : `${r.status} · no nights`,
        href: `/reservations?q=${encodeURIComponent(r.externalId ?? r.guestName ?? "")}`,
        ...ctx(r.propertyId, r.property.name),
      };
    }),
    ...guests.map((g): SearchHit => ({
      id: g.id,
      kind: "guest",
      title: [g.firstName, g.lastName].filter(Boolean).join(" ") || g.email || "Guest",
      /* ⚠️ An OTA forwarding address is not the guest's address — the schema says in as many words
         that no screen may present it as one. It stops working when the booking ends, so showing it
         here would hand a receptionist a dead address to phone about. Prefer the phone; say what the
         address is when it is all we hold. */
      subtitle: (g.emailIsOtaAlias ? (g.phone ?? "channel forwarding address only") : (g.email ?? g.phone)) ?? "no contact details",
      href: `/guests?q=${encodeURIComponent([g.firstName, g.lastName].filter(Boolean).join(" ") || g.email || "")}`,
      ...ctx(g.propertyId, g.property.name),
    })),
    ...properties.map((p): SearchHit => ({
      id: p.id, kind: "hotel", title: p.name, subtitle: p.timezone, href: "/settings",
    })),
    ...roomTypes.map((r): SearchHit => ({
      id: r.id,
      kind: "room",
      title: r.name,
      subtitle: `${r.code} · ${r.totalRooms} room${r.totalRooms === 1 ? "" : "s"}`,
      href: "/rooms-rates",
      ...ctx(r.propertyId, r.property.name),
    })),
    ...ratePlans.map((r): SearchHit => ({
      id: r.id,
      kind: "rate",
      title: r.name,
      subtitle: r.active ? (r.code ?? "rate plan") : "inactive",
      href: "/rooms-rates",
      ...ctx(r.propertyId, r.property.name),
    })),
    // Screens, so the palette is also how you move around.
    ...PAGES.map((p): SearchHit => ({ id: p.href, kind: "page", title: p.title, subtitle: p.sub, href: p.href })),
  ];
}

/** The sidebar's own names, so what somebody types matches what they read. */
const PAGES = [
  { title: "Dashboard", sub: "Today, the action centre and the forecast", href: "/dashboard" },
  { title: "Reservations", sub: "Every booking, from any source", href: "/reservations" },
  { title: "Waitlist", sub: "Guests waiting on a sold-out date", href: "/waitlist" },
  { title: "Guests", sub: "Profiles, history and notes", href: "/guests" },
  { title: "Inventory Calendar", sub: "Availability by room type and date", href: "/inventory" },
  { title: "Rooms & Rates", sub: "Room types, rate plans, restrictions", href: "/rooms-rates" },
  { title: "Bulk Rates & Availability", sub: "Mass edits across dates and rooms", href: "/bulk" },
  { title: "Analytics", sub: "Occupancy, ADR, RevPAR and reports", href: "/reports" },
  { title: "Distribution", sub: "Channels and cost of distribution", href: "/distribution" },
  { title: "Booking Engine", sub: "Your own booking page and its branding", href: "/booking-engine" },
  { title: "Settings", sub: "Property, team, taxes, billing", href: "/settings" },
];
