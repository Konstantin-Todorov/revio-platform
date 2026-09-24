import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, PencilLine } from "lucide-react";
import { getReservationDetail, getCreateFormData, PAYMENT_GUARANTEES } from "@/lib/data";
import { earliestSelectable } from "@revio/core";
import { cancelCrsReservation, markNoShow, modifyReservation } from "@/lib/actions-reservations";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { reservations as reservationsDict } from "@/lib/i18n/reservations";
import { common } from "@/lib/i18n/common";
import { relativeTimeIn } from "@/lib/i18n/relative";
import { DateField } from "@revio/ui/date-field";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", cancelled: "neutral", no_show: "warning",
  overbooked: "danger", failed_import: "danger", expired: "neutral", hold: "warning", draft: "neutral",
};

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

export default async function ReservationDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getReservationDetail(id);
  if (!detail) notFound();
  const { property, reservation: r, timeline, todayIso } = detail;
  const line = r.lines[0];
  const { roomTypes } = await getCreateFormData();
  const { t: tr, money, day, locale } = await i18n();
  const t = tr(reservationsDict).detail;
  const cm = tr(common);
  const relativeTime = relativeTimeIn(locale);

  const isLive = ["confirmed", "modified", "overbooked"].includes(r.status);
  // Channel bookings are mailed by the channel itself; a guest with no address cannot be mailed at all.
  const canEmailGuest = !r.channelId && Boolean(r.guest?.email);
  const checkInIso = line?.checkIn.toISOString().slice(0, 10) ?? "";
  const canNoShow = isLive && r.status !== "overbooked" && checkInIso < todayIso;
  /*
   * ⚠️ `keep-existing`, not `forward-only` — this is the case the platform rule exists for.
   *
   * A guest who arrived on Tuesday has an arrival in the past. That is a fact about a stay that has
   * happened, not a mistake to correct, and refusing it would mean a receptionist cannot extend
   * their departure without first being told their arrival is invalid. So the floor is the earlier
   * of today and the date the booking already holds: you can never push a date FURTHER back than it
   * already is, and you are never locked out of a record because time passed.
   *
   * See `packages/core/src/stays/past-dates.ts` for the four intents and which screens take which.
   */
  const stayFloor = earliestSelectable(todayIso, checkInIso || null);
  const guarantee = r.paymentGuarantee
    ? tr(reservationsDict).guarantees[r.paymentGuarantee] ?? PAYMENT_GUARANTEES.find((g) => g.value === r.paymentGuarantee)?.label ?? "—"
    : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        title={r.guestName}
        subtitle={t.subtitle(r.externalId ?? r.id.slice(-6), property.name)}
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone={TONES[r.status] ?? "neutral"}>{cm.statuses[r.status] ?? r.status.replace("_", " ")}</StatusPill>
            <Link href="/reservations" className="text-[12.5px] font-semibold text-brand-700 hover:underline">{t.all}</Link>
          </div>
        }
      />

      {/*
        * ⚠️ A failed import must explain itself on THIS screen.
        *
        * It is the page a hotel opens when a booking looks wrong, and it used to answer with dashes
        * in every field and "No events recorded for this reservation yet" — while the Error Center
        * held the reason, to the second. An owner read exactly this on 2026-09-15, decided her
        * bookings were being lost, and disconnected her channel.
        *
        * It leads with the CONSEQUENCE, not the cause: the stay is not in the calendar and the room
        * is still on sale. That is what makes somebody act today rather than tomorrow.
        */}
      {r.status === "failed_import" && (
        <div className="rounded-lg border border-danger-500/30 bg-danger-50 px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-bold text-danger-700">
                {t.failedTitle}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                {/* The stored cause is RevioLink's own English; a reader in another language gets ours. */}
                {(locale === "en" ? detail.importFailure?.message?.replace(/^Booking #\S+ could not be imported — /, "") : null) ??
                  t.failedCause}{" "}
                {t.failedWhy}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
                {(locale === "en" ? detail.importFailure?.recommendedAction : null) ?? t.failedFix}
              </p>
              {/* The fix lives in the other product, so link to it rather than describing where it is. */}
              <p className="mt-2 text-[12.5px] text-ink-500">
                {t.failedNothingLost}
              </p>
            </div>
          </div>
        </div>
      )}

      {sp.error && (
        <div className="flex items-center gap-2 rounded-md border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {sp.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.stay} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]">
            <dt className="text-ink-400">{t.room}</dt>
            <dd className="font-semibold text-ink-900">{line ? `${line.roomType.name}${line.quantity > 1 ? ` ×${line.quantity}` : ""}` : "—"}</dd>
            <dt className="text-ink-400">{t.dates}</dt>
            <dd className="tnum text-ink-700">{line ? `${day(checkInIso)} → ${day(line.checkOut.toISOString().slice(0, 10))}` : "—"}</dd>
            <dt className="text-ink-400">{t.guests}</dt>
            <dd className="text-ink-700">{line?.guestsCount ?? "—"}</dd>
            <dt className="text-ink-400">{t.ratePlan}</dt>
            <dd className="text-ink-700">{line?.ratePlan.name ?? "—"}</dd>
            <dt className="text-ink-400">{t.total}</dt>
            <dd className="tnum font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</dd>
            <dt className="text-ink-400">{t.source}</dt>
            <dd className="text-ink-700">{r.channel?.name ?? r.bookingSource?.name ?? cm.direct}</dd>
            <dt className="text-ink-400">{t.guarantee}</dt>
            <dd className="text-ink-700">{guarantee}</dd>
            <dt className="text-ink-400">{t.booked}</dt>
            <dd className="tnum text-ink-700">{day(r.importedAt.toISOString().slice(0, 10))}</dd>
            {r.cancelledAt && (<><dt className="text-ink-400">{t.cancelled}</dt><dd className="tnum text-ink-700">{day(r.cancelledAt.toISOString().slice(0, 10))}</dd></>)}
            {r.notes && (<><dt className="text-ink-400">{t.notes}</dt><dd className="text-ink-700">{r.notes}</dd></>)}
          </dl>
          {isLive && (
            <div className="flex items-center gap-2 border-t border-surface-border/60 px-4 py-3">
              <form action={cancelCrsReservation} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded-md border border-danger-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-danger-600 transition-colors hover:bg-danger-50">
                  {t.cancel}
                </button>
                {canEmailGuest && (
                  <label className="flex items-center gap-1.5 text-[12px] text-ink-600">
                    <input type="checkbox" name="emailGuest" defaultChecked className="h-3.5 w-3.5 rounded border-surface-border" />
                    {t.emailGuest}
                  </label>
                )}
              </form>
              {canNoShow && (
                <form action={markNoShow}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-md border border-warning-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-warning-600 transition-colors hover:bg-warning-50">
                    {t.noShow}
                  </button>
                </form>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t.guest} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]">
            <dt className="text-ink-400">{t.name}</dt>
            <dd className="font-semibold text-ink-900">
              {r.guest ? <Link href={`/guests/${r.guest.id}`} className="text-brand-700 hover:underline">{r.guest.firstName} {r.guest.lastName}</Link> : r.guestName}
            </dd>
            <dt className="text-ink-400">{t.email}</dt><dd className="text-ink-700">{r.guest?.email ?? "—"}</dd>
            <dt className="text-ink-400">{t.phone}</dt><dd className="tnum text-ink-700">{r.guest?.phone ?? "—"}</dd>
            <dt className="text-ink-400">{t.company}</dt><dd className="text-ink-700">{r.guest?.company ?? "—"}</dd>
            <dt className="text-ink-400">{t.requests}</dt><dd className="text-ink-700">{r.guest?.specialRequests ?? "—"}</dd>
          </dl>
        </Card>
      </div>

      {isLive && line && (
        <Card>
          <details>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-bold text-ink-900 hover:bg-surface-muted">
              <PencilLine className="h-4 w-4 text-brand-700" /> {t.modify}
              <span className="text-[11.5px] font-medium text-ink-400">{t.modifyHint}</span>
            </summary>
            <form action={modifyReservation} className="grid grid-cols-2 items-end gap-3 border-t border-surface-border/60 p-4 lg:grid-cols-6">
              <input type="hidden" name="id" value={r.id} />
              <div>
                <label className={labelCls}>{t.roomType}</label>
                <select name="roomTypeId" defaultValue={line.roomTypeId} className={inputCls}>
                  {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>{t.arrival}</label><DateField name="checkIn" defaultValue={checkInIso} min={stayFloor} className={inputCls} /></div>
              <div><label className={labelCls}>{t.departure}</label><DateField name="checkOut" defaultValue={line.checkOut.toISOString().slice(0, 10)} min={stayFloor} className={inputCls} /></div>
              <div><label className={labelCls}>{t.rooms}</label><input type="number" name="quantity" min={1} defaultValue={line.quantity} className={inputCls} /></div>
              <div><label className={labelCls}>{t.totalIn(r.currency)}</label><input type="number" name="price" step="0.01" min="0" defaultValue={(r.totalMinor / 100).toFixed(2)} className={inputCls} /></div>
              <button className="h-[38px] rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">{t.apply}</button>
              {canEmailGuest && (
                <label className="col-span-2 flex items-center gap-1.5 text-[12px] text-ink-600 lg:col-span-6">
                  <input type="checkbox" name="emailGuest" defaultChecked className="h-3.5 w-3.5 rounded border-surface-border" />
                  {t.emailUpdated}
                </label>
              )}
            </form>
          </details>
        </Card>
      )}

      <Card>
        <CardHeader title={t.timeline} />
        {timeline.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-ink-500">
            {r.status === "failed_import"
              ? /* Not "nothing happened" — something happened and we know when. Saying "no events"
                   on the one status that HAS a recorded cause is how this screen misled somebody. */
                t.timelineFailed(r.channel?.name ?? t.theChannel, day(r.importedAt.toISOString().slice(0, 10)))
              : t.timelineEmpty}
          </div>
        ) : (
          <ul className="divide-y divide-surface-border/60">
            {timeline.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 px-4 py-2.5 text-[13px]">
                <span className="font-semibold capitalize text-ink-900">{e.field ? t.fields[e.field] ?? e.field : t.event}</span>
                {e.oldValue && <span className="text-ink-400 line-through">{cm.statuses[e.oldValue] ?? e.oldValue}</span>}
                {e.newValue && <span className="text-ink-700">{cm.statuses[e.newValue] ?? e.newValue}</span>}
                <span className="ml-auto text-[11.5px] text-ink-400">{relativeTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
