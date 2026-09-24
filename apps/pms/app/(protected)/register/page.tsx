import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { validateRegisterEntry, DOCUMENT_TYPE_BG } from "@revio/core";
import { LOCALE_LABELS } from "@revio/ui/i18n";
import { roleHasCapability } from "@/lib/roles";
import { activeProperty } from "@/lib/data";
import { getRegisterEntries, getTouristTax } from "@/lib/register";
import { todayInTz } from "@/lib/format";
import { i18n } from "@/lib/i18n/server";
import { register } from "@/lib/i18n/register";
import { countryIn } from "@/lib/i18n/country";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** First and last day of the month a date falls in. */
function monthBounds(iso: string): { from: string; to: string } {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { from: `${iso.slice(0, 7)}-01`, to: `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { session, property } = await activeProperty();
  // Identity documents. Tighter than the nav guard, which only keeps the scoped roles out.
  if (!roleHasCapability(session.role, "frontDesk")) redirect("/dashboard?error=forbidden");
  const today = todayInTz(property.timezone);
  const { t: tr, money, locale } = await i18n();
  const t = tr(register);
  const countryName = countryIn(locale);
  const { month } = await searchParams;
  const anchor = /^\d{4}-\d{2}$/.test(month ?? "") ? `${month}-01` : today;
  const { from, to } = monthBounds(anchor);

  const [entries, tax] = await Promise.all([
    getRegisterEntries(property.id, property.timezone, from, to),
    getTouristTax(property.id, property.timezone, anchor.slice(0, 7)),
  ]);
  const incomplete = entries.filter((e) => validateRegisterEntry(e).length > 0);
  const nights = entries.reduce((n, e) => n + (e.cancelled ? 0 : e.nights), 0);

  const ym = anchor.slice(0, 7);
  const shift = (delta: number) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const label = new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${ym}-01T00:00:00Z`));

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/api/register/export?from=${from}&to=${to}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
            >
              <Download className="h-4 w-4" /> {t.export(label)}
            </a>
            {/* Excel is the primary button because ЕСТИ publishes an Excel образец. */}
            <a
              href={`/api/register/export?from=${from}&to=${to}&format=csv`}
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-2 text-[12.5px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700"
            >
              CSV
            </a>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/register?month=${shift(-1)}`} className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:border-brand-600 hover:text-brand-700">←</Link>
        <span className="text-[13.5px] font-bold text-ink-900">{label}</span>
        <Link href={`/register?month=${shift(1)}`} className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:border-brand-600 hover:text-brand-700">→</Link>
        <span className="ml-2 text-[12px] text-ink-400">
          {t.counts(entries.length, nights)}
        </span>
      </div>

      {incomplete.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div className="text-[13px] text-warning-700">
            <strong className="font-semibold">{t.notReady(incomplete.length, entries.length)}</strong>{" "}
            {t.notReadyBody}
          </div>
        </div>
      )}

      <Card className="mb-4">
        <CardHeader
          title={t.tax.title}
          subtitle={t.tax.subtitle}
        />
        {tax.rateMinor == null ? (
          <p className="px-4 py-5 text-[13px] text-ink-500">
            {t.tax.noRateBefore}{" "}
            <Link href="/configuration" className="font-semibold text-accent-600 hover:underline">{t.tax.configuration}</Link>{" "}
            {t.tax.noRateAfter}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-surface-border sm:grid-cols-3">
            <div className="bg-surface px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.tax.thisMonth}</div>
              <div className="tnum mt-1 text-[20px] font-bold text-ink-900">{money(tax.monthTaxMinor, property.baseCurrency)}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-500">
                {t.tax.monthLine(tax.monthNights, tax.monthDueDate)}
              </div>
            </div>
            <div className="bg-surface px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.tax.yearToDate}</div>
              <div className="tnum mt-1 text-[20px] font-bold text-ink-900">{money(tax.yearTaxMinor, property.baseCurrency)}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-500">
                {t.tax.yearLine(tax.yearNights, tax.declarationDueDate)}
              </div>
            </div>
            <div className="bg-surface px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t.tax.floor}</div>
              {tax.beds == null ? (
                <p className="mt-1 text-[12px] text-ink-500">
                  {t.tax.setBedsBefore} <strong>{tax.suggestedBeds}</strong>{t.tax.setBedsAfter}
                </p>
              ) : tax.clearsFloor ? (
                <>
                  <div className="tnum mt-1 text-[20px] font-bold text-success-600">{t.tax.cleared}</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-500">
                    {t.tax.clearedLine(money(tax.floorMinor, property.baseCurrency))}
                  </div>
                </>
              ) : (
                <>
                  <div className="tnum mt-1 text-[20px] font-bold text-warning-700">{money(tax.topUpMinor, property.baseCurrency)}</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-500">
                    {t.tax.shortLine(money(tax.floorMinor, property.baseCurrency), tax.topUpDueDate)}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          {t.tax.note[0]} <strong>{t.tax.note[1]}</strong>{t.tax.note[2]}
        </p>
      </Card>

      <Card>
        <CardHeader
          title={t.list.title}
          subtitle={t.list.subtitle(from, to)}
        />
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-400">
            {t.list.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                  {[t.list.cols.no, t.list.cols.registered, t.list.cols.guest, t.list.cols.citizenship, t.list.cols.document, t.list.cols.room, t.list.cols.arrived, t.list.cols.departed, t.list.cols.nights, ""].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const problems = validateRegisterEntry(e);
                  const name = [e.firstName, e.middleName, e.lastName].filter((v) => v && v.trim()).join(" ");
                  return (
                    <tr key={e.id} className={`border-b border-surface-border/60 last:border-0 hover:bg-surface-muted ${e.cancelled ? "opacity-50" : ""}`}>
                      <td className="tnum whitespace-nowrap px-3 py-2 font-bold text-ink-400">
                        {/* The warning above says to open the guest and finish it, so the row has to
                            go somewhere. Without this the instruction was unfollowable. */}
                        <Link href={`/reservation/${e.reservationId}`} className="hover:text-brand-700">{e.registerNo}</Link>
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.registeredAt} {e.registeredAtTime}</td>
                      <td className={`px-3 py-2 font-semibold ${e.cancelled ? "text-ink-400 line-through" : name ? "text-ink-900" : "text-ink-400 italic"}`}>
                        <Link href={`/reservation/${e.reservationId}`} className="hover:text-brand-700 hover:underline">
                          {name || t.list.notCaptured}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{e.nationality ? countryName(e.nationality) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                        {e.documentType ? DOCUMENT_TYPE_BG[e.documentType] : "—"}
                        {e.documentNumber ? <span className="ml-1 text-ink-400">···{e.documentNumber.slice(-4)}</span> : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-600">{e.unitLabel ?? "—"}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.arrivalDate || "—"}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.departureDate ?? t.list.inHouse}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-ink-600">{e.nights}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.cancelled
                          ? <StatusPill tone="neutral">{t.list.cancelled}</StatusPill>
                          : problems.length > 0
                            ? <StatusPill tone="warning">{t.list.missing(problems.length)}</StatusPill>
                            : <StatusPill tone="success">{t.list.complete}</StatusPill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-start gap-2 border-t border-surface-border/60 px-4 py-3 text-[11.5px] text-ink-400">
          <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{t.list.exportNote}</p>
        </div>
      </Card>
    </div>
  );
}
