import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getAssignmentForMove, availableUnitsByRoomType, type AvailableUnit } from "@/lib/data";
import { roomMoveForm } from "@/lib/actions-frontdesk";
import { i18n } from "@/lib/i18n/server";
import { common } from "@/lib/i18n/common";
import { stays } from "@/lib/i18n/stays";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

function unitLabel(u: AvailableUnit, occupied: string, statuses: Record<string, string>): string {
  const state = u.occupied ? occupied : u.hkStatus === "clean" || u.hkStatus === "inspected" ? "" : statuses[u.hkStatus];
  return `${u.label}${u.floor ? ` · ${u.floor}` : ""}${state ? ` · ${state}` : ""}`;
}

export default async function MovePage({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { assignmentId } = await params;
  const { error } = await searchParams;
  const { t } = await i18n();
  const s = t(stays);
  const c = t(common);
  const data = await getAssignmentForMove(assignmentId);
  if (!data) redirect("/dashboard");
  const { assignment: a } = data!;

  // Every free room, not only the booked type. A cross-type move is a real operation — the shower
  // in 101 fails at 23:00 and the only thing free is a Superior Twin — and offering nothing is how
  // a receptionist ends up doing it in the database.
  const groups = (await availableUnitsByRoomType(a.propertyId, ymd(a.checkIn), ymd(a.checkOut), a.id))
    .map((g) => ({ ...g, units: g.units.filter((u) => u.available && u.id !== a.unitId) }))
    .filter((g) => g.units.length > 0);
  const sameType = groups.find((g) => g.roomTypeId === a.line.roomTypeId);
  const otherTypes = groups.filter((g) => g.roomTypeId !== a.line.roomTypeId);
  const free = groups.flatMap((g) => g.units);
  const guestName = a.reservation.guest ? `${a.reservation.guest.firstName} ${a.reservation.guest.lastName}`.trim() : a.reservation.guestName;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> {s.backToDesk}
      </Link>
      <PageHeader title={s.move.title(guestName)} subtitle={s.move.subtitle(a.unit.label, a.line.roomType.name, ymd(a.checkIn), ymd(a.checkOut))} />

      <Card className="p-4">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {s.move.errors[error as keyof typeof s.move.errors] ?? s.somethingWrong}
          </div>
        )}
        {otherTypes.length > 0 && (
          <p className="mb-3 flex items-start gap-1.5 rounded-md bg-brand-50 px-2.5 py-2 text-[12px] text-brand-800">
            <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {s.move.otherTypesNote[0]} <span className="font-semibold">{s.move.otherTypesNote[1]}</span> {s.move.otherTypesNote[2]}
            </span>
          </p>
        )}
        {free.length === 0 ? (
          <p className="text-[13px] text-ink-500">{s.move.noneFree}</p>
        ) : (
          <form action={roomMoveForm} className="space-y-4">
            <input type="hidden" name="assignmentId" value={a.id} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.move.moveTo}</span>
              <select name="unitId" required defaultValue={(sameType?.units[0] ?? free[0]!).id} className="h-10 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] text-ink-900 outline-none focus:border-accent-600">
                {/* The booked type first and on its own, so the ordinary move stays one click and the
                    one with a price consequence is never picked by accident. */}
                {sameType && (
                  <optgroup label={s.move.sameType(sameType.roomTypeName)}>
                    {sameType.units.map((u) => (
                      <option key={u.id} value={u.id}>{unitLabel(u, s.occupied, c.statuses)}</option>
                    ))}
                  </optgroup>
                )}
                {otherTypes.map((g) => (
                  <optgroup key={g.roomTypeId} label={s.move.otherType(g.roomTypeName)}>
                    {g.units.map((u) => (
                      <option key={u.id} value={u.id}>{unitLabel(u, s.occupied, c.statuses)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.move.reason}</span>
              <select name="reason" defaultValue="request" className="h-10 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13.5px] text-ink-900 outline-none focus:border-accent-600">
                <option value="request">{s.move.reasons.request}</option>
                <option value="upgrade">{s.move.reasons.upgrade}</option>
                <option value="maintenance">{s.move.reasons.maintenance}</option>
                <option value="noise">{s.move.reasons.noise}</option>
              </select>
            </label>
            <p className="text-[11.5px] text-ink-400">{s.move.footnote(a.unit.label)}</p>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              <ArrowRightLeft className="h-4 w-4" /> {s.move.submit}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
