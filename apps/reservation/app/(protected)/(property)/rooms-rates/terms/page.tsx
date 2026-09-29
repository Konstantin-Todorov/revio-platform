import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { addDays, stayTerms, stayTermsWords } from "@revio/core";
import { termsPolicyOf } from "@revio/booking";
import { getStayPolicies } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { terms as termsDict } from "@/lib/i18n/terms";

export const dynamic = "force-dynamic";

/**
 * Every set of terms, each with the two facts a guest compares rates by — how much leaves their
 * card today, and whether they can cancel — so the list reads the way the booking page does.
 */
export default async function TermsPage() {
  const { property, policies, todayIso } = await getStayPolicies();
  const { t, locale } = await i18n();
  const s = t(termsDict);
  const lang = locale === "bg" ? "bg" : "en";
  const money = (m: number) => new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency: property.baseCurrency, maximumFractionDigits: 2 }).format(m / 100);
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <Card surface="flat">
      <CardHeader
        surface="flat"
        title={s.title}
        subtitle={s.subtitle}
        action={
          <Link href="/rooms-rates/terms/new" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> {s.add}
          </Link>
        }
      />
      {!property.stripeChargesEnabled && (
        <p className="mx-4 mb-3 rounded-lg border border-warning-600/30 bg-warning-50 px-3 py-2 text-[12.5px] font-medium text-warning-700">{s.notLive}</p>
      )}
      {policies.length === 0 ? (
        <div className="px-4 py-6 text-[13px] text-ink-500">
          <p className="flex items-center gap-2 font-semibold text-ink-700"><FileText className="h-4 w-4" /> {s.empty}</p>
          <p className="mt-1">{s.emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y divide-surface-border/70">
          {policies.map((p) => {
            const w = stayTermsWords(
              stayTerms(termsPolicyOf(p), { totalMinor: 30000, firstNightMinor: 10000, arrival: addDays(todayIso, 30), today: todayIso }),
              lang, money, day,
            );
            return (
              <li key={p.id}>
                <Link href={`/rooms-rates/terms/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink-900">{p.name} <span className="ml-1 text-[11px] font-medium text-ink-400">{p.code}</span></p>
                    <p className="text-[12px] text-ink-500">{w.payment} · {w.cancellation}</p>
                  </div>
                  <span className="text-[11.5px] text-ink-400">{p.ratePlans.length > 0 ? s.usedBy(p.ratePlans.length) : s.unused}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
