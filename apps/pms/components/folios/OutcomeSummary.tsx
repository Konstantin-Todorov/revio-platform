import { Card, CardHeader } from "@/components/ui/primitives";
import { money as moneyEn } from "@/lib/format";
import type { FoliosStrings } from "@/lib/i18n/folios";
import type { OutcomeTotal } from "@/lib/folio-outcomes";

/**
 * How closed folios ended — J1 (§1.4).
 *
 * The rule this exists to hold: **money collected, money owed and money lost are three numbers, and
 * they are never added together.** A single "closed" total would be arithmetic on facts that do not
 * combine — €513 written off and €513 paid off-system are the same figure and opposite events.
 *
 * Every row shows even at zero. "Written off — €0" is information; an absent row reads as "not
 * measured", and a number nobody sees is a number nobody watches.
 */

const TONE: Record<OutcomeTotal["tone"], { dot: string; amount: string }> = {
  collected: { dot: "bg-success-500", amount: "text-ink-900" },
  owed: { dot: "bg-warning-500", amount: "text-warning-700" },
  lost: { dot: "bg-danger-500", amount: "text-danger-700" },
};

export function OutcomeSummary({
  totals,
  headline,
  sinceDays,
  currency,
  t,
  money = (m: number) => moneyEn(m, currency),
}: {
  totals: OutcomeTotal[];
  headline: { collectedMinor: number; owedMinor: number; lostMinor: number };
  sinceDays: number;
  currency: string;
  /** Translated strings; the outcome labels replace the data's English ones by key. */
  t: FoliosStrings["outcomes"];
  money?: (minor: number) => string;
}) {
  const nothingYet = totals.every((t) => t.count === 0);

  return (
    <Card surface="flat" className="mb-4">
      <CardHeader surface="flat"
        title={t.title}
        subtitle={t.subtitle(sinceDays)}
      />

      {nothingYet ? (
        <p className="px-4 py-4 text-[12.5px] text-ink-400">{t.none}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 border-b border-surface-border p-4 sm:grid-cols-3">
            <Headline label={t.collected} amount={money(headline.collectedMinor)} cls="text-ink-900" />
            <Headline label={t.owed} amount={money(headline.owedMinor)} cls="text-warning-700" />
            {/* Never beside "collected" in the same colour, and never summed with it. */}
            <Headline label={t.lost} amount={money(headline.lostMinor)} cls="text-danger-700" />
          </div>

          <ul className="divide-y divide-surface-border">
            {totals.map((o) => (
              <li key={o.outcome} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[o.tone].dot}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-ink-900">{t.labels[o.outcome]?.label ?? o.label}</span>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{t.labels[o.outcome]?.meaning ?? o.meaning}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`tnum text-[13.5px] font-semibold ${TONE[o.tone].amount}`}>
                    {money(o.amountMinor)}
                  </div>
                  <div className="tnum text-[11px] text-ink-400">
                    {t.folios(o.count)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Headline({ label, amount, cls }: { label: string; amount: string; cls: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-muted/40 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`tnum mt-1 text-[19px] font-semibold ${cls}`}>{amount}</div>
    </div>
  );
}
