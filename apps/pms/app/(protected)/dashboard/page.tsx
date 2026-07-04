import Link from "next/link";
import { BedDouble, Sparkles, Wrench, CircleCheck, LogIn, LogOut, Users } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getFrontDeskOverview, type FrontDeskArrival } from "@/lib/data";
import { HK_LABEL } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function prettyDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MO[(m ?? 1) - 1]} ${y}`;
}

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof BedDouble; label: string; value: number; tint: string }) {
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tracking-tight text-ink-900 tnum">{value}</div>
          <div className="mt-1 text-[12px] font-medium text-ink-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function GuestList({ rows, empty }: { rows: FrontDeskArrival[]; empty: string }) {
  if (rows.length === 0) return <div className="px-4 py-6 text-center text-[12.5px] text-ink-400">{empty}</div>;
  return (
    <ul className="divide-y divide-surface-border">
      {rows.map((r, i) => (
        <li key={`${r.reservationId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-ink-900">{r.guestName}</div>
            <div className="text-[11.5px] text-ink-500">{r.roomTypeName} · {r.nights} night{r.nights === 1 ? "" : "s"}</div>
          </div>
          {r.status === "modified" && <StatusPill tone="warning">Modified</StatusPill>}
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const { property, today, counts, totalUnits, arrivals, departures, inHouse } = await getFrontDeskOverview();

  return (
    <div>
      <PageHeader
        title="Front Desk"
        subtitle={`${property.name} · ${prettyDate(today)} (property time)`}
      />

      {totalUnits === 0 && (
        <Card className="mb-5 border-accent-500/40 bg-accent-50 p-4">
          <div className="flex items-start gap-3">
            <BedDouble className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
            <div className="text-[13px] text-ink-700">
              <span className="font-semibold text-ink-900">No rooms set up yet.</span> Add your physical rooms in{" "}
              <Link href="/rooms" className="font-semibold text-accent-600 underline">Rooms</Link> to start housekeeping and (soon) check-in.
            </div>
          </div>
        </Card>
      )}

      {/* Housekeeping status summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={BedDouble} label="Rooms" value={totalUnits} tint="bg-brand-50 text-brand-600" />
        <StatCard icon={CircleCheck} label={HK_LABEL.clean} value={counts.clean} tint="bg-success-50 text-success-600" />
        <StatCard icon={Sparkles} label={HK_LABEL.dirty} value={counts.dirty} tint="bg-warning-50 text-warning-600" />
        <StatCard icon={CircleCheck} label={HK_LABEL.inspected} value={counts.inspected} tint="bg-accent-50 text-accent-600" />
        <StatCard icon={Wrench} label={HK_LABEL.out_of_order} value={counts.out_of_order} tint="bg-danger-50 text-danger-600" />
      </div>

      {/* Today's movements — from the shared reservation record */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Arrivals today" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogIn className="h-3.5 w-3.5" />{arrivals.length}</span>} />
          <GuestList rows={arrivals} empty="No arrivals expected today." />
        </Card>
        <Card>
          <CardHeader title="Departures today" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><LogOut className="h-3.5 w-3.5" />{departures.length}</span>} />
          <GuestList rows={departures} empty="No departures today." />
        </Card>
        <Card>
          <CardHeader title="In house" action={<span className="flex items-center gap-1 text-[12px] font-semibold text-ink-400"><Users className="h-3.5 w-3.5" />{inHouse.length}</span>} />
          <GuestList rows={inHouse} empty="No one in house tonight." />
        </Card>
      </div>

      <p className="mt-5 text-[11.5px] text-ink-400">
        Arrivals, departures and in-house are read from the shared reservation record (RevioCRS / channels).
        Room assignment and check-in / check-out land in Phase 2; folios in Phase 3.
      </p>
    </div>
  );
}
