import Link from "next/link";
import { notFound } from "next/navigation";
import { findDuplicateGuests, getGuestDetail } from "@/lib/data";
import { setGuestRecognitionOptOut, updateGuest } from "@/lib/actions-reservations";
import { GuestNotes, type GuestNoteRow } from "@/components/guests/GuestNotes";
import { DuplicateGuests } from "@/components/guests/DuplicateGuests";
import { DataRights } from "@/components/guests/DataRights";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { LinkTabs } from "@revio/ui/link-tabs";
import { i18n } from "@/lib/i18n/server";
import { guests as guestsDict } from "@/lib/i18n/guests";
import { common } from "@/lib/i18n/common";
import { LOCALE_LABELS } from "@revio/ui/i18n";
import { sampleLabel, hasPattern } from "@revio/core";
import { CalendarPlus } from "lucide-react";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";


const TABS = ["profile", "stays", "notes", "privacy"] as const;
type Tab = (typeof TABS)[number];

/**
 * One guest, in four tabs: Profile (contact, what we have learned, what RevioPMS saw) · Stays ·
 * Notes · Privacy & data. It was eight stacked cards — and the booking history, the thing staff
 * most often open a guest for, was the last of them, below the erasure controls (which were, by a
 * copy-paste, rendered twice). One guest, different questions: each tab answers one.
 */
export default async function GuestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erase?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { erase: eraseState, tab: rawTab } = await searchParams;
  // An erasure step always lands on Privacy & data, where its message is.
  const tab: Tab = eraseState ? "privacy" : (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "profile";
  const detail = await getGuestDetail(id);
  if (!detail) notFound();
  const duplicates = await findDuplicateGuests(id);
  const { property, guest, derived, fromPms, notes } = detail;
  const { t: tr, money, day, locale } = await i18n();
  const t = tr(guestsDict).profile;
  const cm = tr(common);
  const one = new Intl.NumberFormat(LOCALE_LABELS[locale].intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const eraseNotice = eraseState ? t.erase[eraseState as keyof typeof t.erase] : undefined;
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
        subtitle={t.since(property.name, day(guest.createdAt.toISOString().slice(0, 10)))}
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
              {derived.stays > 0 ? t.bookAgain : t.newReservation}
            </Link>
            <Link href="/guests" className="text-[12.5px] font-semibold text-brand-700 hover:underline">{t.all}</Link>
          </div>
        }
      />

      <LinkTabs
        label={t.tabsAria}
        tabs={[
          { href: `/guests/${guest.id}`, label: t.tabs.profile, active: tab === "profile" },
          { href: `/guests/${guest.id}?tab=stays`, label: t.tabs.stays, active: tab === "stays", badge: String(guest.reservations.length) },
          { href: `/guests/${guest.id}?tab=notes`, label: t.tabs.notes, active: tab === "notes", badge: String(notes.length) },
          { href: `/guests/${guest.id}?tab=privacy`, label: t.tabs.privacy, active: tab === "privacy" },
        ]}
      />

      {tab === "profile" && (
        <>
      {/* First on the profile: a possible duplicate changes what every number below means, so the
          offer to merge is read before them. Renders nothing when there is no candidate. */}
      <DuplicateGuests
        guestId={guest.id}
        guestName={`${guest.firstName} ${guest.lastName}`}
        candidates={duplicates}
      />

      <Card>
        <CardHeader title={t.contact} />
        <form action={updateGuest} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-3">
          <input type="hidden" name="id" value={guest.id} />
          <div><label className={labelCls}>{t.firstName}</label><input name="firstName" defaultValue={guest.firstName} className={inputCls} /></div>
          <div><label className={labelCls}>{t.lastName}</label><input name="lastName" defaultValue={guest.lastName} className={inputCls} /></div>
          <div>
            <label className={labelCls}>{t.email}</label>
            <input type="email" name="email" defaultValue={guest.email ?? ""} className={inputCls} />
            {/*
              F4 rule 3. Without this line the address looks like the guest's own, and a hotel emails
              a relay that stopped forwarding when the booking closed — believing it reached someone.
            */}
            {guest.emailIsOtaAlias && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-warning-600">{t.otaAlias}</p>
            )}
          </div>
          <div><label className={labelCls}>{t.phone}</label><input name="phone" defaultValue={guest.phone ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>{t.company}</label><input name="company" defaultValue={guest.company ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>{t.requests}</label><input name="specialRequests" defaultValue={guest.specialRequests ?? ""} className={inputCls} /></div>
          <div className="col-span-2 flex justify-end lg:col-span-3">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">{t.save}</button>
          </div>
        </form>
      </Card>

      {/* Preference layer (spec §3.4) — the edge of "not a CRM": a light, derived layer only. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          {/* §4.4 — the labels now match the evidence.
              "Average stay 3.0 nights" and "Usual room 404" from a single visit were correct numbers
              wearing the wrong words: both claim a pattern established by repetition, and at n=1
              there is no pattern, only the one value that happened. Below two stays the wording
              drops to "Last", and the sample is stated. */}
          <CardHeader
            title={t.preferences}
            subtitle={
              derived.stays === 0
                ? t.prefNone
                : hasPattern(derived.stays)
                  ? t.prefPattern(derived.stays)
                  : t.prefSingle
            }
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, t.preferredRoom, t.roomBooked)}</dt><dd className="mt-0.5 font-semibold text-ink-900">{derived.preferredRoomType ?? "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, t.avgStay, t.lastStay)}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{derived.stays > 0 ? t.nights(one.format(derived.avgLosNights)) : "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, t.avgLead, t.lead)}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{derived.stays > 0 ? t.days(derived.avgLeadDays) : "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.frequency}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{t.stays(derived.stays)}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.lifetime}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(derived.lifetimeAccommodationMinor, property.baseCurrency)}</dd></div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.cancellations}</dt>
              <dd className="mt-0.5 font-semibold text-ink-900">
                {derived.cancelled + derived.noShows === 0
                  ? t.clean
                  : t.cancelRecord(derived.cancelled, derived.noShows, derived.totalBookings)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title={t.duringStay} subtitle={t.duringStaySub} />
          {fromPms.hasPmsData ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.ancillary}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(fromPms.ancillarySpendMinor, property.baseCurrency)}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.avgAncillary}</dt><dd className="tnum mt-0.5 font-semibold text-ink-900">{money(fromPms.avgAncillaryPerStayMinor, property.baseCurrency)}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, t.usualRoom, t.lastRoom)}</dt><dd className="mt-0.5 font-semibold text-ink-900">{fromPms.favouriteUnit ?? "—"}</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{sampleLabel(derived.stays, t.usualFloor, t.lastFloor)}</dt><dd className="mt-0.5 font-semibold text-ink-900">{fromPms.favouriteFloor ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="px-4 py-5 text-[13px] text-ink-500">
              {t.noPms}
            </p>
          )}
        </Card>
      </div>

        </>
      )}

      {tab === "stays" && (
        <>
      <Card>
        <CardHeader title={t.history(guest.reservations.length)} />
        {guest.reservations.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">{t.noHistory}</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">{t.cols.reservation}</th>
                <th className="px-4 py-2.5">{t.cols.stay}</th>
                <th className="px-4 py-2.5">{t.cols.room}</th>
                <th className="px-4 py-2.5">{t.cols.source}</th>
                <th className="px-4 py-2.5 text-right">{t.cols.total}</th>
                <th className="px-4 py-2.5">{t.cols.status}</th>
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
                    <td className="tnum px-4 py-2.5 text-ink-600">{line ? `${day(line.checkIn.toISOString().slice(0, 10))} → ${day(line.checkOut.toISOString().slice(0, 10))}` : "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{line?.roomType.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{r.channel?.name ?? r.bookingSource?.name ?? cm.direct}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{cm.statuses[r.status] ?? r.status.replace("_", " ")}</StatusPill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>

        </>
      )}

      {tab === "notes" && (
        <>
      {/* Staff notes (spec §4) — on the SHARED guest record, so they travel wherever the guest does. */}
      <Card>
        <CardHeader
          title={t.notesTitle(notes.length)}
          subtitle={t.notesSub}
        />
        <GuestNotes guestId={guest.id} notes={noteRows} />
      </Card>

        </>
      )}

      {tab === "privacy" && (
        <>
      {/* Recognition opt-out (K6). A guest who asks not to be greeted as a regular gets that honoured
          everywhere at once, because there is one guest record — the booking page stops saying
          "welcome back" and the front desk stops being told to. Deliberately separate from erasure:
          a hotel keeps the booking and invoice records it is legally required to keep. */}
      <Card>
        <CardHeader
          title={t.privacy}
          subtitle={t.privacySub}
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
              <span className="font-semibold text-ink-900">{t.optOut}</span>
              <span className="mt-0.5 block text-[12px] text-ink-500">{t.optOutBody}</span>
            </span>
          </label>
          <button
            type="submit"
            className="rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
          >
            {t.save}
          </button>
        </form>
      </Card>

      {/* Last in its tab, deliberately. Erasure is irreversible and there is no undo anywhere in
          this product, so it sits below the everyday privacy choice rather than beside it. */}
      <DataRights
        guestId={guest.id}
        guestName={`${guest.firstName} ${guest.lastName}`}
        erasedAt={guest.erasedAt}
        {...(eraseNotice ? { notice: eraseNotice } : {})}
      />
        </>
      )}
    </div>
  );
}
