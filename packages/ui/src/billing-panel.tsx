import type { PriceBreakdown } from "@revio/core";
import { billingStrings } from "./billing-strings";
import { LOCALE_LABELS, fill, formatMoney, translate, type Locale } from "./i18n";

/**
 * What a hotel pays us, and what we have billed them — inside their own product.
 *
 * ## Why this exists
 *
 * The founder, 2026-09-11: *"дали не трябва и трите софтуера в админ акаунтите да имат билинг част
 * и да виждат какво става като цяло."* Until now every fact about the commercial relationship lived
 * in the operator console: the customer could see the software and never the account behind it. To
 * find out what they pay, or whether last month's invoice was received, they had to ring us.
 *
 * ## The shape it borrows
 *
 * A utility bill, because that is the document everybody in the world already knows how to read:
 * **the amount first, then the arithmetic that produced it, then the history.** Rule 1 of
 * `docs/UI-STANDARD.md`. The one thing it does not borrow is the utility habit of hiding the
 * derivation — a price a customer cannot reconstruct is a price they will argue with, and every
 * line of ours is defensible, so it is all shown.
 *
 * ## The figures are computed, never stored twice
 *
 * `breakdown` comes from `priceBreakdown` in `@revio/core` — the same function that produces the
 * invoice. That is the whole reason the pricing model moved out of the operator app. If this screen
 * had its own copy of the arithmetic, the first time the two disagreed the customer would be right
 * and we would look like we could not count.
 *
 * ## What it deliberately does NOT offer
 *
 * No "upgrade", no "cancel", no plan picker. Every one of those is a conversation with a price in
 * it, and a button that starts a commercial change the software cannot finish is worse than no
 * button (the same rule that kept "try it" out of the account menu until the mechanism existed).
 * What it offers is to pay, which is the one thing a customer genuinely wants to do alone.
 */

export interface BillingInvoiceRow {
  id: string;
  period: string;
  amountMinor: number;
  currency: string;
  status: string;
  lineItems: string | null;
  paidAt: Date | null;
  payUrl: string | null;
  sandbox: boolean;
  refundedMinor: number;
}

/** "2026-09" → "September 2026". A billing period is a month, so it should read as one. */
function periodLabel(period: string, locale: Locale): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(LOCALE_LABELS[locale].intl, {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function BillingPanel({
  breakdown,
  planLabel,
  rooms,
  trials,
  invoices,
  payment,
  currency = "EUR",
  locale = "en",
}: {
  breakdown: PriceBreakdown;
  /** The room-count tier, in the words the price list uses. */
  planLabel: string;
  rooms: number;
  /** Products running free right now, so the zero beside them is explained rather than surprising. */
  trials: { name: string; endsAt: Date }[];
  invoices: BillingInvoiceRow[];
  payment: { legalName: string; iban: string; bic: string | null; bankName: string | null; email: string | null } | null;
  currency?: string;
  /** A server component, so the language arrives as a prop. */
  locale?: Locale;
}) {
  const s = translate(billingStrings, locale).panel;
  const money = (minor: number, cur = "EUR") => formatMoney(minor, cur, locale);
  const intl = LOCALE_LABELS[locale].intl;
  const outstanding = invoices.filter((i) => i.status !== "paid");
  const joinAnd = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${s.and} ${xs[xs.length - 1]}`);

  return (
    <div className="space-y-4">
      {/*
        1. THE NUMBER, and the sum that makes it. Anything a customer has to add up themselves is a
        number they will get wrong once and then distrust forever.
      */}
      <section className="rounded-xl border border-surface-border bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{s.monthlyPlan}</p>
            <p className="mt-1 text-[27px] font-bold leading-none tracking-tight text-ink-900">
              {money(breakdown.totalMinor, currency)}
              <span className="ml-1.5 text-[13px] font-semibold text-ink-400">{s.perMonth}</span>
            </p>
          </div>
          <p className="text-[12px] text-ink-500">
            {planLabel} · {fill(rooms === 1 ? s.roomsOne : s.roomsMany, { n: rooms })}
          </p>
        </div>

        <dl className="mt-5 space-y-0 border-t border-surface-border">
          <Row label={s.platformFee} hint={planLabel} value={money(breakdown.platformMinor, currency)} />
          {breakdown.modules.map((m) => (
            <Row key={m.key} label={m.label} value={money(m.minor, currency)} />
          ))}
          {breakdown.discountMinor > 0 && (
            <Row
              label={fill(s.bundleDiscount, { n: breakdown.modules.length })}
              /*
               * The discount is stated as a reason, not just a number. It is the price list agreeing
               * with the architecture: the second and third products share the same database, the
               * same onboarding and need no migration, so they cost us almost nothing to deliver.
               */
              hint={s.bundleHint}
              value={`− ${money(breakdown.discountMinor, currency)}`}
              tone="credit"
            />
          )}
          <Row label={s.total} value={money(breakdown.totalMinor, currency)} strong />
        </dl>

        {/*
          ⚠️ It says where VAT is decided rather than deciding it.
          `decideVat` has three registrations, not two — under чл. 97а we hold a BG VAT number and are
          FORBIDDEN to state VAT on a Bulgarian invoice — and the treatment depends on where the
          customer is. A sentence on this screen that guessed at a rate would be a tax statement made
          by a dashboard. The invoice is the document that carries it, and it already does.
        */}
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
          {s.vatNote}
        </p>

        {trials.length > 0 && (
          <p className="mt-3 rounded-md bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-600">
            {fill(trials.length === 1 ? s.trialsOne : s.trialsMany, {
              names: joinAnd(trials.map((t) => t.name)),
              dates: joinAnd(trials.map((t) => t.endsAt.toLocaleDateString(intl, { day: "numeric", month: "long" }))),
            })}
          </p>
        )}
      </section>

      {/* 2. WHAT IS OWED, if anything. Its own block, above the history, because an unpaid invoice is
          the only thing on this page that needs the reader to do something. */}
      {outstanding.length > 0 && (
        <section className="rounded-xl border border-warning-200 bg-warning-50 p-5">
          <h2 className="text-[13.5px] font-semibold text-warning-800">
            {outstanding.length === 1 ? s.owedOne : fill(s.owedMany, { n: outstanding.length })}
          </h2>
          <p className="mt-1 text-[12.5px] text-ink-600">
            {fill(s.owedTotal, { amount: money(outstanding.reduce((sum, i) => sum + i.amountMinor, 0), currency) })}
          </p>
          {payment && (
            <div className="mt-3 rounded-lg border border-warning-200 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-ink-700">
              <p className="font-semibold text-ink-900">{s.byTransfer}</p>
              <p className="mt-1">
                {payment.legalName}
                {payment.bankName ? ` · ${payment.bankName}` : ""}
              </p>
              {/*
                ⚠️ Grouped in fours and given room to breathe, which is how a bank prints an IBAN and
                how a person checks one. The first version set `tracking-tight` on a monospace face
                and the `0` ran into the `B` beside it — caught by looking at the rendered page
                rather than by any test, which is rule 4 of `docs/UI-STANDARD.md` earning its place.
                A mistyped IBAN is a payment that goes nowhere and takes a week to find.
              */}
              <p className="mt-1 font-mono text-[13px] tracking-wide text-ink-900">
                {payment.iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()}
              </p>
              {payment.bic && <p className="mt-0.5 text-[11.5px] text-ink-500">BIC {payment.bic}</p>}
              <p className="mt-1.5 text-[11.5px] text-ink-500">
                {s.reference}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 3. THE HISTORY. A bill with no history is a demand; with one it is an account. */}
      <section className="rounded-xl border border-surface-border bg-white">
        <div className="border-b border-surface-border px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold text-ink-900">{s.invoices}</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {s.invoicesIntro}
          </p>
        </div>

        {invoices.length === 0 ? (
          <p className="px-5 py-6 text-[12.5px] text-ink-500">
            {s.noInvoices}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-border text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2">{s.cols.period}</th>
                  <th className="px-5 py-2">{s.cols.for}</th>
                  <th className="px-5 py-2 text-right">{s.cols.amount}</th>
                  <th className="px-5 py-2">{s.cols.status}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-surface-border last:border-0 align-top">
                    <td className="px-5 py-3 text-[12.5px] font-semibold text-ink-900">{periodLabel(i.period, locale)}</td>
                    <td className="px-5 py-3 text-[12px] text-ink-500">{i.lineItems ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-[12.5px] font-semibold tabular-nums text-ink-900">
                      {money(i.amountMinor, i.currency)}
                      {/* Money that came back is stated beside the amount, never subtracted from it:
                          the invoice still records what was supplied and what was paid. */}
                      {i.refundedMinor > 0 && (
                        <span className="mt-0.5 block text-[11px] font-normal text-ink-400">
                          {fill(s.refunded, { amount: money(i.refundedMinor, i.currency) })}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {i.status === "paid" ? (
                        <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-success-700">
                          {s.paid}{i.paidAt ? ` ${i.paidAt.toLocaleDateString(intl, { day: "numeric", month: "short" })}` : ""}
                        </span>
                      ) : (
                        <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-warning-800">
                          {s.due}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {i.payUrl && (
                        <a
                          href={i.payUrl}
                          className="inline-block rounded-md bg-brand-800 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700"
                        >
                          {s.payByCard}
                        </a>
                      )}
                      {/* A test-mode link looks identical to a real one and takes no money. Somebody
                          must never believe they have paid. */}
                      {i.payUrl && i.sandbox && (
                        <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                          {s.testLink}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="px-1 text-[12px] leading-relaxed text-ink-500">
        {s.wrongBefore}
        {payment?.email ? fill(s.wrongEmail, { email: payment.email }) : ""}
        {s.wrongAfter}
      </p>
    </div>
  );
}

function Row({
  label, hint, value, strong, tone,
}: {
  label: string;
  hint?: string;
  value: string;
  strong?: boolean;
  tone?: "credit";
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-surface-border py-2.5 last:border-0 ${
        strong ? "border-t-0 font-semibold" : ""
      }`}
    >
      <dt className="min-w-0">
        <span className={`text-[13px] ${strong ? "font-semibold text-ink-900" : "text-ink-700"}`}>{label}</span>
        {hint && <span className="mt-0.5 block max-w-[52ch] text-[11.5px] leading-snug text-ink-400">{hint}</span>}
      </dt>
      <dd
        className={`shrink-0 tabular-nums ${
          strong ? "text-[15px] font-bold text-ink-900" : tone === "credit" ? "text-[13px] font-semibold text-success-700" : "text-[13px] text-ink-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
