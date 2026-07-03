import Link from "next/link";
import { BedDouble, CalendarOff, CalendarRange, Camera, TrendingDown } from "lucide-react";
import { getInventoryBoard } from "@/lib/data";
import { prisma } from "@/lib/db";
import { ensurePickupSnapshot, getPickupStatus } from "@/lib/pickup";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/**
 * Phase 1 dashboard: tonight's waterfall + low-availability watch + snapshot status. The full
 * metric cards (Occupancy/ADR/RevPAR/Pickup) arrive in Phase 4 — computed from the same records.
 */
export default async function DashboardPage() {
  const board = await getInventoryBoard({ days: 14 });
  await ensurePickupSnapshot();

  const [pickup, upcomingPeriods] = await Promise.all([
    getPickupStatus(board.property.id, board.property.timezone),
    prisma.roomInventoryPeriod.findMany({
      where: { propertyId: board.property.id, dateTo: { gte: new Date(`${board.todayIso}T00:00:00Z`) } },
      include: { roomType: { select: { name: true } } },
      orderBy: { dateFrom: "asc" },
      take: 6,
    }),
  ]);

  // Tonight = the first column of the board (the property-timezone today).
  const tonight = board.sections.map((s) => s.cells[0]!);
  const sum = (pick: (c: (typeof tonight)[number]) => number) => tonight.reduce((a, c) => a + pick(c), 0);
  const cards = [
    { label: "Physical rooms", value: sum((c) => c.physical), sub: "across all room types" },
    { label: "Available tonight", value: sum((c) => c.available), sub: "after out-of-order & closures" },
    { label: "Sold tonight", value: sum((c) => c.confirmed), sub: "confirmed reservations" },
    { label: "Remaining tonight", value: sum((c) => c.remaining), sub: "left to sell right now" },
  ];

  // Low-availability watch: next 14 days where a room type is nearly (or over) sold out.
  const lowDates: { date: string; roomType: string; remaining: number }[] = [];
  board.sections.forEach((s) =>
    s.cells.forEach((c, i) => {
      if (c.remaining <= 1) lowDates.push({ date: board.dates[i]!, roomType: s.roomType.name, remaining: c.remaining });
    }),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`${board.property.name} · today is ${board.todayIso} (property time)`}
        action={
          <Link href="/inventory" className="flex h-8 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
            <CalendarRange className="h-3.5 w-3.5" /> Inventory Calendar
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{c.label}</div>
            <div className={`tnum mt-1 text-[26px] font-bold leading-none ${c.label === "Remaining tonight" && c.value <= 0 ? "text-danger-600" : "text-ink-900"}`}>{c.value}</div>
            <div className="mt-1.5 text-[11.5px] text-ink-400">{c.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Low availability · next 14 days" />
          {lowDates.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-[13px] text-ink-500">
              <BedDouble className="h-5 w-5 text-success-600" /> No room type is close to selling out in the next two weeks.
            </div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {lowDates.slice(0, 8).map((l, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                  <span className="font-semibold text-ink-900">{l.roomType}</span>
                  <span className="tnum text-ink-500">{l.date}</span>
                  <StatusPill tone={l.remaining < 0 ? "danger" : l.remaining === 0 ? "danger" : "warning"}>
                    {l.remaining < 0 ? `overbooked by ${-l.remaining}` : l.remaining === 0 ? "sold out" : "1 left"}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Out-of-order & closures" action={<Link href="/setup" className="text-[12px] font-semibold text-brand-700 hover:underline">Manage</Link>} />
          {upcomingPeriods.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-[13px] text-ink-500">
              <CalendarOff className="h-5 w-5 text-ink-300" /> Nothing is out of order or closed from today on.
            </div>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {upcomingPeriods.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink-900">{p.roomType.name}</span>
                  <span className="tnum shrink-0 text-ink-500">{p.dateFrom.toISOString().slice(0, 10)} → {p.dateTo.toISOString().slice(0, 10)}</span>
                  <StatusPill tone={p.kind === "closure" ? "info" : "warning"}>{p.kind === "closure" ? `closed ×${p.rooms}` : `OOO ×${p.rooms}`}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Pickup snapshots" />
        <div className="flex items-start gap-3 px-4 py-4 text-[13px] text-ink-600">
          {pickup.firstSnapshot ? (
            <>
              <Camera className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <div>
                Recording rooms sold per future date <span className="font-semibold text-ink-900">since {pickup.firstSnapshot}</span>
                {pickup.latestSnapshot && pickup.latestSnapshot !== pickup.firstSnapshot && <> · latest {pickup.latestSnapshot}</>}
                {pickup.todayRows > 0 && <> · today’s snapshot captured ({pickup.todayRows} data points)</>}.
                <span className="text-ink-400"> Pickup &amp; Pace reports (Phase 4) will compare “sold now” against these snapshots — history builds from day one because it can’t be backfilled.</span>
              </div>
            </>
          ) : (
            <>
              <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-ink-300" />
              <div>No snapshots yet — the first one is taken automatically on the first visit (or nightly run) of each day.</div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
