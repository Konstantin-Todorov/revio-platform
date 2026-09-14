"use server";

import { isSearchable, roleCanOpenProduct, type SearchHit } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";

/**
 * What ⌘K finds in RevioLink.
 *
 * ## ⚠️ Every property the account holds, not just the active one
 *
 * The founder's decision, and the reasoning is the failure it removes: *"if the thing is in another
 * property you do not find it and you do not understand why."* A chain switches property to work,
 * not to search, and a search that silently answers for one building is worse than one that says it
 * found nothing.
 *
 * That is safe because it is not a widening of access: `getSession` already resolves the tenant,
 * every query below is filtered to properties of THAT tenant, and RLS refuses another tenant's rows
 * underneath regardless. Each hit carries `context` — the property name — so two identically named
 * rooms are never confused; the palette only draws it when the account has more than one property,
 * because on a single-property hotel it is noise on every row.
 *
 * ## Why this is a server action and not an API route
 *
 * It is called from a client component on every keystroke, so it needs the session; a route would
 * need its own auth. `guard` is not used deliberately — this READS what the person can already open
 * and writes nothing. It is gated by having a session at all, which is the same gate the screens it
 * links to apply.
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
  if (!roleCanOpenProduct(session.role, "cm")) return [];

  const term = query.trim();
  const where = { property: { tenantId: session.tenantId } };
  const take = 6;
  const like = { contains: term, mode: "insensitive" as const };

  const [roomTypes, ratePlans, channels, reservations, properties] = await Promise.all([
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
    prisma.channel.findMany({
      where: { ...where, name: like },
      select: { id: true, name: true, code: true, status: true, propertyId: true, property: { select: { name: true } } },
      take,
    }),
    prisma.reservation.findMany({
      where: { ...where, OR: [{ guestName: like }, { externalId: like }] },
      /* ⚠️ `importedAt`, not a stay date. A reservation's nights live on its LINES, and RevioLink's
         own question about a booking is "when did it arrive from the channel" rather than "when do
         they sleep here" — that is RevioCRS's question. Joining lines here would cost a query per
         keystroke to answer the wrong one. */
      select: {
        id: true, guestName: true, externalId: true, importedAt: true, status: true, propertyId: true,
        channel: { select: { name: true } }, property: { select: { name: true } },
      },
      orderBy: { importedAt: "desc" },
      take,
    }),
    // The tenant's own properties, so "which hotel am I looking at" is itself searchable.
    prisma.property.findMany({
      where: { tenantId: session.tenantId, name: like },
      select: { id: true, name: true, timezone: true },
      take: 4,
    }),
  ]);

  // Only name the property when there is more than one to confuse it with.
  const multi = (await prisma.property.count({ where: { tenantId: session.tenantId } })) > 1;
  /* ⚠️ The id travels with the name. `context` tells the reader WHICH hotel a row is in; the id is
     what lets the click actually open it, because every screen this links to is scoped to the active
     property. Kept together so a new hit kind cannot pick up one without the other. */
  const ctx = (id: string, name: string) => (multi ? { context: name, propertyId: id } : { propertyId: id });
  const day = (d: Date) => d.toISOString().slice(0, 10);

  return [
    ...reservations.map((r): SearchHit => ({
      id: r.id,
      kind: "reservation",
      title: r.guestName || r.externalId || "Reservation",
      subtitle: `${r.channel?.name ?? "direct"} · ${r.status} · arrived ${day(r.importedAt)}`,
      href: `/reservations?q=${encodeURIComponent(r.externalId ?? r.guestName ?? "")}`,
      ...ctx(r.propertyId, r.property.name),
    })),
    ...properties.map((p): SearchHit => ({
      id: p.id, kind: "hotel", title: p.name, subtitle: p.timezone, href: "/settings/property",
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
    ...channels.map((c): SearchHit => ({
      id: c.id, kind: "channel", title: c.name, subtitle: c.status, href: "/channels",
      ...ctx(c.propertyId, c.property.name),
    })),
    // Screens, so the palette is also how you move around. Filtered by the same ranking as
    // everything else, so typing "map" reaches Mapping without it competing with real data.
    ...PAGES.map((p): SearchHit => ({ id: p.href, kind: "page", title: p.title, subtitle: p.sub, href: p.href })),
  ];
}

const PAGES = [
  { title: "Calendar", sub: "Availability, rates and restrictions", href: "/calendar" },
  { title: "Bulk update", sub: "Mass edits across dates and rooms", href: "/bulk-update" },
  { title: "Rooms & rates", sub: "Room types, rate plans, linkage", href: "/rooms-rates" },
  { title: "Channels", sub: "Connected channels and settings", href: "/channels" },
  { title: "Mapping", sub: "Match your products to the channel's", href: "/mapping" },
  { title: "Reservations", sub: "Everything pulled from the channels", href: "/reservations" },
  { title: "Sync center", sub: "Pushes, pulls and what failed", href: "/sync" },
  { title: "Settings", sub: "Property, team, billing", href: "/settings" },
];
