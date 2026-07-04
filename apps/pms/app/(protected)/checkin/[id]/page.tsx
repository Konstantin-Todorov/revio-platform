import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogIn, DoorOpen, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getReservationForCheckin, availableUnitsFor, type AvailableUnit } from "@/lib/data";
import { checkIn } from "@/lib/actions-frontdesk";
import { HK_LABEL } from "@/lib/hk-meta";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  pick: "Select a room for every slot.",
  dup: "Each room can only be assigned once.",
  type: "That room is a different room type — tick “Allow override” to assign it anyway.",
  dirty: "That room isn’t clean/inspected — tick “Allow override” to assign it anyway.",
  busy: "That room is already occupied for these dates.",
};

function unitLabel(u: AvailableUnit): string {
  const state = u.occupied ? "Occupied" : u.hkStatus === "clean" || u.hkStatus === "inspected" ? "" : HK_LABEL[u.hkStatus];
  return `${u.label}${u.floor ? ` · ${u.floor}` : ""}${state ? ` · ${state}` : ""}`;
}

export default async function CheckinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const data = await getReservationForCheckin(id);
  if (!data) redirect("/dashboard");
  const { reservation: r } = data!;

  const alreadyIn = r.assignments.length > 0;

  // Expand each line into `quantity` room slots and fetch available units for each line's room type once.
  const byRoomType = new Map<string, AvailableUnit[]>();
  for (const line of r.lines) {
    if (!byRoomType.has(line.roomTypeId)) {
      byRoomType.set(line.roomTypeId, await availableUnitsFor(line.roomTypeId, ymd(line.checkIn), ymd(line.checkOut)));
    }
  }
  const slots = r.lines.flatMap((line) =>
    Array.from({ length: Math.max(1, line.quantity) }, (_, i) => ({
      key: `${line.id}-${i}`, lineId: line.id, roomTypeId: line.roomTypeId, roomTypeName: line.roomType.name,
      units: byRoomType.get(line.roomTypeId) ?? [],
    })),
  );
  const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
  const anyFree = slots.some((s) => s.units.some((u) => u.available));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader title={`Check in — ${guestName}`} subtitle={`${ymd(r.lines[0]!.checkIn)} → ${ymd(r.lines[r.lines.length - 1]!.checkOut)} · ${r.lines.length} room${r.lines.length === 1 ? "" : "s"}`} />

      {alreadyIn ? (
        <Card className="p-6 text-center">
          <p className="text-[14px] font-semibold text-ink-900">Already checked in</p>
          <p className="mt-1 text-[12.5px] text-ink-500">This reservation is in house ({r.assignments.map((a) => a.unit.label).join(", ")}).</p>
          <Link href="/dashboard" className="mt-3 inline-block rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700">Back to Front Desk</Link>
        </Card>
      ) : (
        <Card className="p-4">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[error] ?? "Something went wrong — try again."}
            </div>
          )}
          <form action={checkIn} className="space-y-4">
            <input type="hidden" name="reservationId" value={r.id} />

            {slots.map((slot, idx) => {
              const free = slot.units.filter((u) => u.available);
              return (
                <div key={slot.key}>
                  <label className="mb-1 flex items-center gap-2 text-[12.5px] font-semibold text-ink-700">
                    <DoorOpen className="h-4 w-4 text-accent-500" />
                    Room {slots.length > 1 ? idx + 1 : ""} · {slot.roomTypeName}
                    <span className="text-[11px] font-medium text-ink-400">({free.length} free)</span>
                  </label>
                  <select
                    name="slot"
                    defaultValue={free[0] ? `${slot.lineId}:${free[0].id}` : ""}
                    required
                    className="h-10 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] text-ink-900 outline-none focus:border-accent-600"
                  >
                    <option value="" disabled>Select a room…</option>
                    {slot.units.map((u) => (
                      <option key={u.id} value={`${slot.lineId}:${u.id}`} disabled={u.occupied}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
              <input type="checkbox" name="override" className="h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
              Allow override (assign a room that isn’t clean or is a different type — logged)
            </label>

            {!anyFree && (
              <p className="rounded-md bg-warning-50 px-3 py-2 text-[12px] font-medium text-warning-600">
                No clean, free rooms of this type right now. Tick “Allow override” to assign one anyway, or clean a room first.
              </p>
            )}

            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <LogIn className="h-4 w-4" /> Check in
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
