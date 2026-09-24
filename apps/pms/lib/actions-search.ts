"use server";

import { isSearchable, roleCanOpenProduct, type SearchHit } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { i18n } from "./i18n/server";
import { pages } from "./i18n/pages";
import { shell } from "./i18n/shell";
import { common } from "./i18n/common";
import { guests as guestsDict } from "./i18n/guests";
import { firstAllowed, visibleTo } from "./search-scope";

/**
 * What ⌘K finds in RevioPMS.
 *
 * ## ⚠️ Every property the account holds, not just the active one
 *
 * The founder's decision, applied identically in all four products: *"if the thing is in another
 * property you do not find it and you do not understand why."* Room numbers repeat across a chain —
 * almost every hotel has a 101 — so `context` carries the property name and the palette draws it
 * whenever the account holds more than one. Without that badge this widening would be dangerous
 * rather than useful, which is why the two ship together.
 *
 * ## What RevioPMS searches that the others do not
 *
 * The **physical room**. RevioLink and RevioCRS deal in room *types* — a category that can be sold;
 * RevioPMS deals in the unit somebody sleeps in and somebody else has to clean. A receptionist types
 * "101" far more often than they type a guest's surname, so units rank above guests here by carrying
 * the `unit` kind, which the shared ranking already orders ahead of rate plans and channels.
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
  if (!roleCanOpenProduct(session.role, "pms")) return [];

  const term = query.trim();
  const tenantId = session.tenantId;
  const where = { property: { tenantId } };
  const take = 6;
  const like = { contains: term, mode: "insensitive" as const };

  const [units, guests, reservations, properties, propertyCount] = await Promise.all([
    prisma.unit.findMany({
      where: { ...where, active: true, OR: [{ label: like }, { roomType: { name: like } }] },
      select: {
        id: true, label: true, hkStatus: true, floor: true,
        roomType: { select: { name: true } }, propertyId: true, property: { select: { name: true } },
      },
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
    prisma.reservation.findMany({
      where: { ...where, OR: [{ guestName: like }, { externalId: like }] },
      select: {
        id: true, guestName: true, externalId: true, status: true, departedAt: true, importedAt: true,
        propertyId: true,
        property: { select: { name: true } },
        lines: { select: { checkIn: true, checkOut: true }, orderBy: { checkIn: "asc" }, take: 1 },
      },
      orderBy: { importedAt: "desc" },
      take,
    }),
    prisma.property.findMany({
      where: { tenantId, name: like },
      select: { id: true, name: true, timezone: true },
      take: 4,
    }),
    prisma.property.count({ where: { tenantId } }),
  ]);

  // Only name the property when there is more than one to confuse it with.
  /* ⚠️ The id travels with the name — `context` says WHICH hotel a row is in, and the id is what
     makes the click work, because every screen this links to is scoped to the active property.
     Kept in one expression so a new hit kind cannot pick up one without the other. */
  const ctx = (id: string, name: string) => (propertyCount > 1 ? { context: name, propertyId: id } : { propertyId: id });
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const { t: tr } = await i18n();
  const say = tr(pages).palette;
  const nav = tr(shell).nav as Record<string, string>;
  const hk = tr(common).statuses as Record<string, string>;
  const resStatus = tr(guestsDict).profile.statuses;

  return visibleTo(session.role, [
    ...reservations.map((r): SearchHit => {
      const line = r.lines[0];
      /* ⚠️ `departedAt` decides whether a stay has ended — never `status`. `status` is the CRS's
         commercial record (a departed guest's stay is still sold and still earns), so reading it as
         "are they still here" tells the front desk the wrong thing about a checked-out room. */
      const state = r.departedAt ? say.departed : (resStatus[r.status] ?? r.status);
      return {
        id: r.id,
        kind: "reservation",
        title: r.guestName || r.externalId || say.reservation,
        subtitle: line ? `${day(line.checkIn)} → ${day(line.checkOut)} · ${state}` : `${state} · ${say.noNights}`,
        href: `/reservation/${r.id}`,
        ...ctx(r.propertyId, r.property.name),
      };
    }),
    ...guests.map((g): SearchHit => ({
      id: g.id,
      kind: "guest",
      title: [g.firstName, g.lastName].filter(Boolean).join(" ") || g.email || say.guest,
      /* ⚠️ An OTA forwarding address is not the guest's address — the schema says so in as many
         words. It dies with the booking, so offering it to a receptionist about to make contact is
         worse than showing nothing. */
      subtitle: (g.emailIsOtaAlias ? (g.phone ?? say.forwardingOnly) : (g.email ?? g.phone)) ?? say.noContact,
      href: `/guests?q=${encodeURIComponent([g.firstName, g.lastName].filter(Boolean).join(" ") || g.email || "")}`,
      ...ctx(g.propertyId, g.property.name),
    })),
    ...units.map((u): SearchHit => ({
      id: u.id,
      kind: "unit",
      title: u.label,
      /* ⚠️ The housekeeping board's OWN labels, imported rather than restated. The first draft of
         this file wrote its own map and invented a status (`awaiting_inspection`) that the product
         does not have, while calling `inspected` "ready" where the board says "Inspected" — two
         names for one room state, which is exactly how a receptionist and a housekeeper end up
         describing the same room differently. */
      subtitle: `${u.roomType.name} · ${hk[u.hkStatus] ?? u.hkStatus}${u.floor ? ` · ${/^\d+$/.test(u.floor) ? say.floor(u.floor) : u.floor}` : ""}`,
      /* The cleaning board first, the room inventory second — see `firstAllowed`. A room means the
         board to the person cleaning it and the record to the person fixing it, and neither can
         open the other's screen. `null` never survives the scope filter, so it is safe to coerce. */
      href: firstAllowed(session.role, ["/housekeeping", "/rooms"]) ?? "/housekeeping",
      ...ctx(u.propertyId, u.property.name),
    })),
    ...properties.map((p): SearchHit => ({
      id: p.id, kind: "hotel", title: p.name, subtitle: p.timezone, href: "/settings",
    })),
    // Screens, so the palette is also how you move around.
    ...PAGES.map((p): SearchHit => ({ id: p.href, kind: "page", title: nav[p.href] ?? p.title, subtitle: say.subs[p.href] ?? p.sub, href: p.href })),
  ]);
}

/**
 * The sidebar's own names, so what somebody types matches what they read.
 *
 * Every screen is listed; `visibleTo` then drops the ones this role may not open, so a housekeeper's
 * "Go to" section contains Housekeeping and Help and nothing else. Filtering here instead would put
 * a second role rule in a second place.
 */
const PAGES = [
  { title: "Front Desk", sub: "Arrivals, departures, in-house", href: "/dashboard" },
  { title: "Calendar", sub: "Reservations by room and date", href: "/calendar" },
  { title: "Guests", sub: "Profiles, identity and preferences", href: "/guests" },
  { title: "Folios & Billing", sub: "Open folios, charges and invoices", href: "/folios" },
  { title: "Guest Register", sub: "The statutory register of who stayed", href: "/register" },
  { title: "Extras & Charges", sub: "Minibar, outlets and tap-to-post", href: "/minibar" },
  { title: "Housekeeping", sub: "Room status, assignments and inspection", href: "/housekeeping" },
  { title: "Rooms", sub: "Units, floors, beds and occupancy", href: "/rooms" },
  { title: "Maintenance", sub: "Faults, crew and out-of-order rooms", href: "/maintenance" },
  { title: "Staff & Access", sub: "Roster, roles and clock-in", href: "/users" },
  { title: "Configuration", sub: "Property setup and operational rules", href: "/configuration" },
  { title: "Close Day", sub: "The night audit", href: "/closeday" },
  /* ⚠️ Help is in every role's scope on purpose — `roles.ts` says why: the person who cannot open
     Settings is the one most likely to be standing in front of a broken screen. */
  { title: "Help", sub: "Ask us anything", href: "/help" },
];
