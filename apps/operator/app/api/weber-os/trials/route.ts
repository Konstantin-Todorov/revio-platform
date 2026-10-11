import { NextResponse, type NextRequest } from "next/server";
import { forSystem } from "@revio/db";

/**
 * The running trials, read by Weber OS (our own back office) so it can draft a personal nudge to a
 * hotel that has not started using what it is trying.
 *
 * The platform already sends the clock emails itself (7 days, 1 day, finished — `trial-sweep`).
 * What it cannot judge is whether a hotel is stuck: no rooms on day three, no channel on day ten.
 * Those notes are written by a person, so Weber OS only proposes drafts for the office to approve
 * and send from office@reviosoft.app. Nothing here sends anything.
 *
 * ## Read-only, counts only, fail closed
 *
 * The owner's name, email, phone and locale leave the platform, because that is who the note is for;
 * everything else is a count or a yes/no — no guests, no reservations, no prices. `forSystem()` is
 * correct for the same reason as `/api/leads`: the caller is a server with no tenant, and this is an
 * operator view across hotels. A missing `WEBER_OS_TRIALS_SECRET` answers 503 rather than serving
 * hotel contacts to anyone who finds the URL. Demo and test tenants are left out.
 */

export const dynamic = "force-dynamic";

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const countBy = (rows: { tenantId: string; _count: { _all: number } }[]) =>
  new Map(rows.map((r) => [r.tenantId, r._count._all]));

export async function GET(req: NextRequest) {
  const expected = process.env.WEBER_OS_TRIALS_SECRET?.trim();
  if (!expected || expected.length < 32) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secretMatches(given, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = forSystem();
  // A trial counts from `openedAt`; a row without it is an invitation nobody has opened yet.
  const trials = await db.productTrial.findMany({
    where: { endedAt: null, openedAt: { not: null }, tenant: { isDemo: false } },
    select: {
      tenantId: true, product: true, openedAt: true, endsAt: true, keepRequestedAt: true,
      tenant: {
        select: {
          name: true,
          users: { where: { role: "owner", active: true }, take: 1, select: { name: true, email: true, phone: true, locale: true } },
        },
      },
    },
    orderBy: { openedAt: "asc" },
  });
  const ids = [...new Set(trials.map((t) => t.tenantId))];
  if (!ids.length) return NextResponse.json({ ok: true, at: new Date().toISOString(), hotels: [] });

  const inT = { tenantId: { in: ids } };
  const [properties, rooms, rates, channels, reservations, fromChannels, engines, active] = await Promise.all([
    db.property.groupBy({ by: ["tenantId"], where: { ...inT, status: "active" }, _count: { _all: true } }),
    db.roomType.groupBy({ by: ["tenantId"], where: { ...inT, active: true }, _count: { _all: true } }),
    db.ratePlan.groupBy({ by: ["tenantId"], where: { ...inT, active: true }, _count: { _all: true } }),
    // A real OTA link: not the mock adapter, and the channel reports itself connected.
    db.channel.groupBy({ by: ["tenantId"], where: { ...inT, status: "connected", connectivityMode: { not: "mock" } }, _count: { _all: true } }),
    db.reservation.groupBy({ by: ["tenantId"], where: inT, _count: { _all: true } }),
    db.reservation.groupBy({ by: ["tenantId"], where: { ...inT, channelId: { not: null } }, _count: { _all: true } }),
    db.property.findMany({ where: { ...inT, bookingEngineEnabled: true }, select: { tenantId: true, stripeChargesEnabled: true } }),
    db.activeUserDay.groupBy({ by: ["tenantId"], where: inT, _max: { day: true } }),
  ]);
  const n = { properties: countBy(properties), rooms: countBy(rooms), rates: countBy(rates), channels: countBy(channels), reservations: countBy(reservations), fromChannels: countBy(fromChannels) };
  const lastActive = new Map(active.map((a) => [a.tenantId, a._max.day]));

  const hotels = ids.map((id) => {
    const own = trials.filter((t) => t.tenantId === id);
    const owner = own[0]!.tenant.users[0] ?? null;
    return {
      tenantId: id,
      name: own[0]!.tenant.name,
      owner: owner ? { name: owner.name, email: owner.email, phone: owner.phone, locale: owner.locale } : null,
      trials: own.map((t) => ({ product: t.product, openedAt: t.openedAt, endsAt: t.endsAt, keepRequested: !!t.keepRequestedAt })),
      properties: n.properties.get(id) ?? 0,
      roomTypes: n.rooms.get(id) ?? 0,
      ratePlans: n.rates.get(id) ?? 0,
      otaChannels: n.channels.get(id) ?? 0,
      reservations: n.reservations.get(id) ?? 0,
      channelReservations: n.fromChannels.get(id) ?? 0,
      bookingEngine: engines.some((e) => e.tenantId === id),
      stripe: engines.some((e) => e.tenantId === id && e.stripeChargesEnabled),
      lastActiveDay: lastActive.get(id) ?? null,
    };
  });
  return NextResponse.json({ ok: true, at: new Date().toISOString(), hotels });
}
