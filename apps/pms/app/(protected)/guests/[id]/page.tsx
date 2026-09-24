import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Building2, Bed, MapPin, Wine, StickyNote, GitMerge, Users } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getPmsGuestProfile } from "@/lib/guests";
import { findDuplicateGuests } from "@/lib/guest-identity";
import { mergeGuests } from "@/lib/actions-guests";
import { i18n } from "@/lib/i18n/server";
import { guests } from "@/lib/i18n/guests";

export const dynamic = "force-dynamic";

const TONES: Record<string, Tone> = {
  confirmed: "success", modified: "info", checked_in: "success", checked_out: "neutral",
  cancelled: "neutral", no_show: "warning",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="tnum mt-1 text-[18px] font-bold text-ink-900">{value}</div>
      {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPmsGuestProfile(decodeURIComponent(id));
  if (!data) notFound();
  const { property, guestId, guest, stats, favouriteItems, notes, reservations } = data;
  const cur = property.baseCurrency;
  const { t: tr, money } = await i18n();
  const t = tr(guests).profile;
  // Duplicate detection (spec §3.5) — only for guests with a real Guest record (identity foundation, J0).
  const duplicates = guestId ? await findDuplicateGuests(guestId) : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/guests" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </Link>
      <PageHeader
        title={guest.name}
        subtitle={t.subtitle(stats.stays, stats.nights)}
        action={
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-500">
            {guest.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{guest.email}</span>}
            {guest.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{guest.phone}</span>}
            {guest.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{guest.company}</span>}
          </div>
        }
      />

      {/* Possible duplicates (spec §3.5) — same email/phone/name. Merging collapses the other record onto
          THIS one (re-parents its stays + notes), so every metric stops fragmenting. */}
      {duplicates.length > 0 && (
        <Card className="mb-4 border-warning-500/40 bg-warning-50/50">
          <div className="flex items-start gap-2 px-4 py-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" />
            <div className="w-full">
              <div className="text-[12.5px] font-semibold text-warning-800">
                {t.duplicates(duplicates.length)}
              </div>
              <ul className="mt-2 space-y-1.5">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-500/30 bg-white px-3 py-2">
                    <div className="min-w-0 text-[12.5px]">
                      <Link href={`/guests/${d.id}`} className="font-semibold text-ink-900 hover:text-accent-600 hover:underline">{d.name}</Link>
                      <span className="ml-1.5 text-ink-400">{d.email ?? d.phone ?? ""}</span>
                      <StatusPill tone="warning">{t.dupReason[d.reason as keyof typeof t.dupReason] ?? d.reason}</StatusPill>
                    </div>
                    <form action={mergeGuests}>
                      <input type="hidden" name="winnerId" value={guestId!} />
                      <input type="hidden" name="loserId" value={d.id} />
                      <button className="inline-flex items-center gap-1.5 rounded-md bg-warning-700 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-warning-600">
                        <GitMerge className="h-3.5 w-3.5" /> {t.merge}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-warning-700/80">{t.mergeNote}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Derived operational stats (spec §3.3) */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.stats.lifetime} value={money(stats.lifetimeMinor, cur)} hint={t.stats.lifetimeHint} />
        <Stat label={t.stats.avgNightly} value={money(stats.avgNightlyMinor, cur)} hint={t.stats.avgNightlyHint} />
        <Stat label={t.stats.avgAncillary} value={money(stats.avgAncillaryPerStayMinor, cur)} hint={t.stats.avgAncillaryHint} />
        <Stat label={t.stats.ancillaryLifetime} value={money(stats.ancillaryMinor, cur)} hint={t.stats.ancillaryLifetimeHint} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Preferences derived from operational history */}
        <Card>
          <CardHeader title={t.preferences} subtitle={t.preferencesSub} />
          {!stats.enoughHistory ? (
            /* n≥2 guard (§3.3): one stay is not a preference — a wrong "usual" is worse than none. */
            <p className="px-4 py-3 text-[12.5px] text-ink-400">{t.notEnough}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Bed className="h-3.5 w-3.5" /> {t.preferredRoom}</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{stats.preferredRoom ?? "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><MapPin className="h-3.5 w-3.5" /> {t.preferredFloor}</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{stats.preferredFloor ?? "—"}</dd>
              </div>
            </dl>
          )}
          <div className="border-t border-surface-border/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><Wine className="h-3.5 w-3.5" /> {t.favourites}</div>
            {favouriteItems.length === 0 ? (
              <p className="mt-1 text-[12.5px] text-ink-400">{t.noFavourites}</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {favouriteItems.map((it) => (
                  <li key={it.name} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-700">{it.name} <span className="text-ink-400">×{it.count}</span></span>
                    <span className="tnum text-ink-500">{money(it.amountMinor, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Requests & notes */}
        <Card>
          <CardHeader title={t.notes} subtitle={t.notesSub} />
          {notes.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-400">{t.noNotes}</p>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {notes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-[13px] text-ink-700">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" /> {n}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Stay history */}
      <Card className="mt-4">
        <CardHeader title={t.history(reservations.length)} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">{t.cols.reservation}</th>
                <th className="px-4 py-2.5">{t.cols.stay}</th>
                <th className="px-4 py-2.5">{t.cols.roomType}</th>
                <th className="px-4 py-2.5">{t.cols.source}</th>
                <th className="px-4 py-2.5 text-right">{t.cols.total}</th>
                <th className="px-4 py-2.5">{t.cols.status}</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5"><Link href={`/reservation/${r.id}`} className="tnum font-semibold text-accent-600 hover:underline">#{r.id.slice(-6)}</Link></td>
                  <td className="tnum px-4 py-2.5 text-ink-600">{r.checkIn ?? "—"} → {r.checkOut ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-600">{r.roomType}</td>
                  <td className="px-4 py-2.5 text-ink-600">{r.source}</td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold text-ink-900">{money(r.totalMinor, r.currency)}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={TONES[r.status] ?? "neutral"}>{t.statuses[r.status] ?? r.status.replace("_", " ")}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
