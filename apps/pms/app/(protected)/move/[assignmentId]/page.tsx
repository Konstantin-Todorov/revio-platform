import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getAssignmentForMove, availableUnitsFor, type AvailableUnit } from "@/lib/data";
import { roomMove } from "@/lib/actions-frontdesk";
import { HK_LABEL } from "@/lib/hk-meta";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  pick: "Pick a different room to move to.",
  busy: "That room is already occupied for these dates.",
};

function unitLabel(u: AvailableUnit): string {
  const state = u.occupied ? "Occupied" : u.hkStatus === "clean" || u.hkStatus === "inspected" ? "" : HK_LABEL[u.hkStatus];
  return `${u.label}${u.floor ? ` · ${u.floor}` : ""}${state ? ` · ${state}` : ""}`;
}

export default async function MovePage({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { assignmentId } = await params;
  const { error } = await searchParams;
  const data = await getAssignmentForMove(assignmentId);
  if (!data) redirect("/dashboard");
  const { assignment: a } = data!;

  const units = await availableUnitsFor(a.line.roomTypeId, ymd(a.checkIn), ymd(a.checkOut), a.id);
  const free = units.filter((u) => u.available && u.id !== a.unitId);
  const guestName = a.reservation.guest ? `${a.reservation.guest.firstName} ${a.reservation.guest.lastName}`.trim() : a.reservation.guestName;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader title={`Move room — ${guestName}`} subtitle={`Currently in ${a.unit.label} · ${a.line.roomType.name} · ${ymd(a.checkIn)} → ${ymd(a.checkOut)}`} />

      <Card className="p-4">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[error] ?? "Something went wrong — try again."}
          </div>
        )}
        {free.length === 0 ? (
          <p className="text-[13px] text-ink-500">No other free, clean {a.line.roomType.name} available for these dates.</p>
        ) : (
          <form action={roomMove} className="space-y-4">
            <input type="hidden" name="assignmentId" value={a.id} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Move to</span>
              <select name="unitId" required defaultValue={free[0]!.id} className="h-10 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] text-ink-900 outline-none focus:border-accent-600">
                {free.map((u) => (
                  <option key={u.id} value={u.id}>{unitLabel(u)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Reason</span>
              <select name="reason" defaultValue="request" className="h-10 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] text-ink-900 outline-none focus:border-accent-600">
                <option value="request">Guest request</option>
                <option value="upgrade">Upgrade</option>
                <option value="maintenance">Maintenance</option>
                <option value="noise">Noise</option>
              </select>
            </label>
            <p className="text-[11.5px] text-ink-400">The guest keeps the same stay; {a.unit.label} is set dirty for housekeeping. The reason is logged to the room timeline.</p>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <ArrowRightLeft className="h-4 w-4" /> Move room
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
