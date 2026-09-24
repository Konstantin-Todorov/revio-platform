import Link from "next/link";
import { SubmitButton } from "@revio/ui/submit-button";
import { ArrowLeft, UserPlus, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getWalkInOptions } from "@/lib/data";
import { walkIn } from "@/lib/actions-frontdesk";
import { i18n } from "@/lib/i18n/server";
import { stays } from "@/lib/i18n/stays";

export const dynamic = "force-dynamic";

const inputCls = "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export default async function WalkInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { roomTypes, standardPlanId } = await getWalkInOptions();
  const s = (await i18n()).t(stays);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> {s.backToDesk}
      </Link>
      <PageHeader title={s.walkin.title} subtitle={s.walkin.subtitle} />

      <Card className="p-4">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {s.walkin.errors[error as keyof typeof s.walkin.errors] ?? s.somethingWrong}
          </div>
        )}
        {roomTypes.length === 0 || !standardPlanId ? (
          <p className="text-[13px] text-ink-500">
            {s.walkin.needsSetup}
          </p>
        ) : (
          <form action={walkIn} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.walkin.firstName}</span>
                <input name="firstName" required className={inputCls} placeholder={s.walkin.firstNamePlaceholder} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.walkin.lastName}</span>
                <input name="lastName" required className={inputCls} placeholder={s.walkin.lastNamePlaceholder} />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.walkin.roomType}</span>
              <select name="roomTypeId" required defaultValue={roomTypes[0]!.id} className={inputCls}>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{s.walkin.maxGuests(rt.name, rt.maxGuests)}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.walkin.nights}</span>
                <input name="nights" type="number" min={1} max={60} defaultValue={1} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">{s.walkin.guests}</span>
                <input name="guests" type="number" min={1} max={10} defaultValue={2} className={inputCls} />
              </label>
            </div>

            <p className="text-[11.5px] text-ink-400">
              {s.walkin.rateNote}
            </p>

            {/*
              ⚠️ Pending-aware, because a second press here is a second GUEST.

              This was a plain submit button. A walk-in writes a guest, a reservation, a room
              assignment, a folio and a register entry, then pushes availability — slow enough that
              the screen sits unchanged and the natural move is to press again. On 2026-09-09 the
              demo hotel got exactly that: "Maria Ivanova" checked in twice, 1.2 seconds apart, into
              rooms 101 AND 102, with two folios. The first request had finished, so the second saw
              101 taken and correctly picked 102 — nothing raced; the button simply accepted two
              presses. The shared SubmitButton disables itself while the action runs.
            */}
            <SubmitButton
              pendingLabel={<><UserPlus className="h-4 w-4" /> {s.walkin.submit}…</>}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-500"
            >
              <UserPlus className="h-4 w-4" /> {s.walkin.submit}
            </SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
