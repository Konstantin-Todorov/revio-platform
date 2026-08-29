import Link from "next/link";
import { notFound } from "next/navigation";
import { findDuplicateGuests, getGuestDetail } from "@/lib/data";
import { setGuestRecognitionOptOut, updateGuest } from "@/lib/actions-reservations";
import { GuestNotes, type GuestNoteRow } from "@/components/guests/GuestNotes";
import { DuplicateGuests } from "@/components/guests/DuplicateGuests";
import { DataRights } from "@/components/guests/DataRights";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { money } from "@/lib/format";
import { sampleLabel, hasPattern } from "@revio/core";
import { CalendarPlus } from "lucide-react";
import { OTA_ALIAS_NOTE } from "@revio/core";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

const ERASE_NOTICE: Record<string, string> = {
  confirm: "Type ERASE in the box to confirm — this cannot be undone.",
  "already-erased": "This guest record has already been erased.",
  "merged-record":
    "This record has been merged into another. Erase the surviving record instead — that is the one holding the guest's data.",
};

export default async function GuestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erase?: string }>;
}) {
  const { id } = await params;
  const eraseState = (await searchParams).erase;
  const detail = await getGuestDetail(id);
  if (!detail) notFound();
  const duplicates = await findDuplicateGuests(id);
  const { property, guest, derived, fromPms, notes } = detail;
  const noteRows: GuestNoteRow[] = notes.map((n) => ({
    id: n.id,
    authorName: n.authorName,
    body: n.body,
    createdIso: n.createdAt.toISOString(),
    edited: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        subtitle={`${property.name} · guest since ${guest.createdAt.toISOString().slice(0, 10)}`}
        action={
          <div className="flex items-center gap-3">
            {/* §4.2 — the concrete home for the §3.2 bypass, and the highest-leverage add on this
                screen. Their room type and typical party come along, so a rebook is one click into
                the same hold → details → confirm tail search-first uses. */}
            <Link
              href={`/reservations/new?guest=${guest.id}${derived.preferredRoomTypeId ? `&rt=${derived.preferredRoomTypeId}` : ""}${derived.typicalGuests ? `&guests=${derived.typicalGuests}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <CalendarPlus className="h-4 w-4" />
              {derived.stays > 0 ? "Book again" : "New reservation"}
            </Link>
            <Link href="/guests" className="text-[12.5px] font-semibold text-brand-700 hover:underline">← All guests</Link>
          </div>
        }
      />

      <Card>
        <CardHeader title="Contact & requests" />
        <form action={updateGuest} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-3">
          <input type="hidden" name="id" value={guest.id} />
          <div><label className={labelCls}>First name</label><input name="firstName" defaultValue={guest.firstName} className={inputCls} /></div>
          <div><label className={labelCls}>Last name</label><input name="lastName" defaultValue={guest.lastName} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" name="email" defaultValue={guest.email ?? ""} className={inputCls} />
            {/*
              F4 rule 3. Without this line the address looks like the guest's own, and a hotel emails
              a relay that stopped forwarding when the booking closed — believing it reached someone.
            */}
            {guest.emailIsOtaAlias && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-warning-600">{OTA_ALIAS_NOTE}</p>
            )}
          </div>
          <div><label className={labelCls}>Phone</label><input name="phone" defaultValue={guest.phone ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Company</label><input name="company" defaultValue={guest.company ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Special requests</label><input name="specialRequests" defaultValue={guest.specialRequests ?? ""} className={inputCls} /></div>
          <div className="col-span-2 flex justify-end lg:col-span-3">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save</button>
          </div>
        </form>
      </Card>

      {/* Preference layer (spec §3.4) — the edge of "not a CRM": a light, derived layer only. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {/* §4.4 — the labels now match the evidence.
              "Average stay 3.0 nights" and "Usual room 404" from a single visit were correct numbers
              wearing the wrong words: both claim a pattern established by repetition, and at n=1
              there is no pattern, only the one value that happened. Below two stays the wording
              drops to "Last", and the sample is stated. */}
          <CardHeader
            title="Preferences"
            subtitle={
              derived.stays === 0
                ? "Nothing to work from yet — this fills in after their first stay"
                : hasPattern(derived.stays)
                  ? `Worked out from ${derived.stays} past stays`
                  : "From their single stay so far — not yet a pattern"
            }
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, "Preferred room type", "Room type booked")}</dt><dd className="mt-0.5 font-semibold text-ink-900">{derived.preferredRoomType ?? "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, "Average stay", "Last stay")}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{derived.stays > 0 ? `${derived.avgLosNights.toFixed(1)} nights` : "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, "Average lead time", "Lead time")}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{derived.stays > 0 ? `${derived.avgLeadDays} days` : "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Booking frequency</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{derived.stays} stay{derived.stays === 1 ? "" : "s"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Lifetime accommodation</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(derived.lifetimeAccommodationMinor, property.baseCurrency)}</dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Cancellation behaviour</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">
                {derived.cancelled + derived.noShows === 0
                  ? "clean record"
                  : `${derived.cancelled} cancelled · ${derived.noShows} no-show of ${derived.totalBookings}`}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="During their stay" subtitle="Recorded by RevioPMS — shown here, edited there" />
          {fromPms.hasPmsData ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Ancillary spend (lifetime)</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(fromPms.ancillarySpendMinor, property.baseCurrency)}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Avg ancillary / stay</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(fromPms.avgAncillaryPerStayMinor, property.baseCurrency)}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, "Usual room", "Last room")}</dt><dd className="mt-0.5 font-semibold text-ink-900">{fromPms.favouriteUnit ?? "—"}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, "Usual floor", "Last floor")}</dt><dd className="mt-0.5 font-semibold text-ink-900">{fromPms.favouriteFloor ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="px-4 py-5 text-[13px] text-ink-500">
              No PMS data for this guest yet — these fields fill in once the property runs RevioPMS (folio + room-assignment history).
            </p>
          )}
        </Card>
      </div>

      {/* Recognition opt-out (K6). A guest who asks not to be greeted as a regular gets that honoured
          everywhere at once, because there is one guest record — the booking page stops saying
          "welcome back" and the front desk stops being told to. Deliberately separate from erasure:
          a hotel keeps the booking and invoice records it is legally required to keep. */}
      <Card>
        <CardHeader
          title="Privacy"
          subtitle="What this guest has asked us not to do — honoured across RevioDirect, RevioCRS and RevioPMS at once"
        />
        <form action={setGuestRecognitionOptOut} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <input type="hidden" name="guestId" value={guest.id} />
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="optOut"
              defaultChecked={guest.recognitionOptOut}
              className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-600"
            />
            <span>
              <span className="font-semibold text-ink-900">Do not recognise this guest across stays</span>
              <span className="mt-0.5 block text-[12px] text-ink-500">
                Suppresses &ldquo;welcome back&rdquo; on the booking page and the returning-guest note for the
                front desk. Their stay history is unchanged and still counts in every report.
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            Save
          </button>
        </form>
      </Card>

      {/* Staff notes (spec §4) — on the SHARED guest record, so they travel wherever the guest does. */}
      <Card>
        <CardHeader
          title={`Notes (${notes.length})`}
          subtitle="Staff notes — visible wherever this guest appears, in every Revio product you run"
        />
        <GuestNotes guestId={guest.id} notes={noteRows} />
      </Card>

      {/* Above the booking history on purpose: the history is what a merge changes, so the offer to
          merge should be read before it, not after. */}
      <DuplicateGuests
        guestId={guest.id}
        guestName={`${guest.firstName} ${guest.lastName}`}
        candidates={duplicates}
      />

      {/* Last on the page, deliberately: erasure is irreversible and should not sit above the
          everyday editing. */}
      <DataRights
        guestId={guest.id}
        guestName={`${guest.firstName} ${guest.lastName}`}
        erasedAt={guest.erasedAt}
        {...(eraseState && ERASE_NOTICE[eraseState] ? { notice: ERASE_NOTICE[eraseState] } : {})}
      />

      <Card>
        <CardHeader title={`Booking history (${guest.reservations.length})`} />
        {guest.reservations.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">No reservations for this guest yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Reservation</th>
                <th className="px-4 py-2.5">Stay</th>
                <th className="px-4 py-2.5">Room</th>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {guest.reservations.map((r) => {
                const line = r.lines[0];
                return (
                  <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      <Link href={`/reservations/${r.id}`} className="tnum font-semibold text-brand-700 hover:underline">#{r.externalId ?? r.id.slice(-6)}</Link>
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink-600">{line ? `${line.checkIn.toISOString().slice(0, 10)} → ${line.checkOut.toISOString().slice(0, 10)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{line?.roomType.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{r.channel?.name ?? r.bookingSource?.name ?? "Direct"}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</StatusPill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {/* Last on the page, deliberately. Erasure is irreversible and there is no undo anywhere in
          this product, so it sits below the everyday editing rather than beside it. */}
      <DataRights
        guestId={guest.id}
        guestName={`${guest.firstName} ${guest.lastName}`}
        erasedAt={guest.erasedAt}
        {...(eraseState && ERASE_NOTICE[eraseState] ? { notice: ERASE_NOTICE[eraseState] } : {})}
      />
    </div>
  );
}
