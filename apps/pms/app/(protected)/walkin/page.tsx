import Link from "next/link";
import { ArrowLeft, UserPlus, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getWalkInOptions } from "@/lib/data";
import { walkIn } from "@/lib/actions-frontdesk";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  fields: "Enter the guest’s name and pick a room type.",
  full: "No free, clean room of that type right now — clean or free a room first.",
  norate: "This property has no standard rate plan yet — set one up in RevioLink / RevioCRS first.",
};

const inputCls = "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[13.5px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";

export default async function WalkInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { roomTypes, standardPlanId } = await getWalkInOptions();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader title="Walk-in" subtitle="Create a same-day booking and check the guest straight in." />

      <Card className="p-4">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {ERRORS[error] ?? "Something went wrong — try again."}
          </div>
        )}
        {roomTypes.length === 0 || !standardPlanId ? (
          <p className="text-[13px] text-ink-500">
            This property needs room types and a standard rate plan before walk-ins work. Configure them in RevioLink / RevioCRS.
          </p>
        ) : (
          <form action={walkIn} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">First name</span>
                <input name="firstName" required className={inputCls} placeholder="Maria" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">Last name</span>
                <input name="lastName" required className={inputCls} placeholder="Ivanova" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-600">Room type</span>
              <select name="roomTypeId" required defaultValue={roomTypes[0]!.id} className={inputCls}>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name} (max {rt.maxGuests})</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">Nights</span>
                <input name="nights" type="number" min={1} max={60} defaultValue={1} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-600">Guests</span>
                <input name="guests" type="number" min={1} max={10} defaultValue={2} className={inputCls} />
              </label>
            </div>

            <p className="text-[11.5px] text-ink-400">
              The room rate is taken from the standard plan for the stay. Payment is recorded later on the folio
              (Phase 3) — no card is handled here.
            </p>

            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-500">
              <UserPlus className="h-4 w-4" /> Create &amp; check in
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
