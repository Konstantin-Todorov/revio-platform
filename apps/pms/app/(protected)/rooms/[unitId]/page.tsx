import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Play, CircleCheck, Wrench, Ban, User, CircleDot } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getRoomTimeline, type RoomEvent } from "@/lib/maintenance";
import { HK_LABEL, HK_TONE, type HkStatus } from "@/lib/hk-meta";

export const dynamic = "force-dynamic";

const ICON: Record<RoomEvent["kind"], typeof CircleDot> = {
  clean: CircleCheck, in_progress: Play, inspected: CircleCheck, ooo: Ban,
  issue: Wrench, repaired: CircleCheck, guest: User, other: CircleDot,
};
const TINT: Record<RoomEvent["kind"], string> = {
  clean: "bg-success-100 text-success-700", in_progress: "bg-brand-100 text-brand-700",
  inspected: "bg-accent-100 text-accent-700", ooo: "bg-danger-100 text-danger-700",
  issue: "bg-warning-100 text-warning-700", repaired: "bg-success-100 text-success-700",
  guest: "bg-brand-100 text-brand-700", other: "bg-ink-100 text-ink-500",
};

function fmt(d: Date): string {
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function RoomTimelinePage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const data = await getRoomTimeline(unitId);
  if (!data) notFound();
  const { unit, events } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/rooms" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Rooms
      </Link>
      <PageHeader
        title={`Room ${unit.label}`}
        subtitle={`${unit.roomType}${unit.floor ? ` · ${unit.floor}` : ""} · lifecycle history`}
        action={<StatusPill tone={HK_TONE[unit.hkStatus as HkStatus]}>{HK_LABEL[unit.hkStatus as HkStatus]}</StatusPill>}
      />

      <Card>
        <CardHeader title="Room timeline" subtitle="Cleaned → issue reported → out of order → repaired → back in service — from housekeeping, maintenance and moves" />
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-ink-400">No recorded history for this room yet. Housekeeping, maintenance and guest activity will build up here.</div>
        ) : (
          <ol className="p-4">
            {events.map((e, i) => {
              const Icon = ICON[e.kind];
              return (
                <li key={i} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TINT[e.kind]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-surface-border" />}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-[13px] font-semibold text-ink-900">{e.label}</div>
                    {e.detail && <div className="text-[12px] text-ink-500">{e.detail}</div>}
                    <div className="tnum text-[11px] text-ink-400">{fmt(e.at)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <Sparkles className="h-3.5 w-3.5" /> The per-room history pairs with the reservation timeline — one for the room, one for the stay.
      </p>
    </div>
  );
}
