import { Card, StatusPill } from "@/components/ui/primitives";
import { setVatRegistration } from "@/lib/actions-integrations";
import { VAT_REGISTRATIONS, type VatRegistration } from "@/lib/vat";
import { thresholdAdvice, type ThresholdStatus } from "@/lib/vat-threshold";

/**
 * Which VAT registration we hold — and what it does to every invoice.
 *
 * ## Why three radio buttons and not a switch
 *
 * The founder asked for "a toggle", and a toggle would be wrong. Bulgaria has a **third state
 * between registered and not**, and it is the one we are in: **чл. 97а ЗДДС** gives a real BG VAT
 * number that is valid only for cross-border services. Under it we hold a number and are
 * nonetheless forbidden to put VAT on a Bulgarian invoice (чл. 113, ал. 9).
 *
 * Reading the number's presence as "registered" is what put 20% on every domestic invoice until
 * 2026-09-09. A two-state switch would have encoded exactly the same mistake in a nicer control.
 *
 * ## Why each option states its consequence
 *
 * This is a tax setting on a page of address fields, and the person choosing is not a tax adviser.
 * A radio labelled "чл. 97а" tells them nothing; a radio that says what a Bulgarian customer will
 * see on their next invoice tells them everything they need to choose correctly
 * (`docs/UI-STANDARD.md` rule 2 — say it before it is read).
 */
export function VatRegistrationCard({
  current,
  vatId,
  country,
  canEdit,
  threshold,
}: {
  current: VatRegistration;
  vatId: string | null;
  country: string;
  canEdit: boolean;
  threshold: ThresholdStatus;
}) {
  const advice = thresholdAdvice(threshold, current);
  /*
   * A company already registered under чл. 96 has passed this gate for good, so the bar carries no
   * warning for it — it is just a turnover figure.
   *
   * Also caught by looking at the page: at 120% of the threshold a fully-registered company got a
   * RED bar and, correctly, no message explaining it. Alarm with nothing to do about it is the
   * fastest way to teach somebody to ignore the colour everywhere else on the screen.
   */
  const informational = current === "full";
  const pct = Math.min(100, Math.round(threshold.pctUsed));
  const eur = (m: number) => `€${(m / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-ink-900">VAT registration</h3>
          <p className="mt-0.5 max-w-[68ch] text-[11.5px] leading-relaxed text-ink-400">
            Decides the tax on every invoice issued from now on. Invoices already sent are never
            changed by this — correcting one that has been filed is a credit note, not a setting.
          </p>
        </div>
        {!vatId && current !== "none" && <StatusPill tone="warning">No VAT number on file</StatusPill>}
      </div>

      <form action={setVatRegistration} className="space-y-2">
        {VAT_REGISTRATIONS.map((opt) => {
          const selected = opt.value === current;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                selected ? "border-brand-600 bg-brand-50" : "border-surface-border hover:bg-surface-muted"
              } ${canEdit ? "" : "cursor-not-allowed opacity-60"}`}
            >
              <input
                type="radio"
                name="vatRegistration"
                value={opt.value}
                defaultChecked={selected}
                disabled={!canEdit}
                className="mt-1 h-3.5 w-3.5 accent-brand-800"
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink-900">{opt.label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-500">{opt.detail}</span>
              </span>
            </label>
          );
        })}

        {canEdit && (
          <div className="pt-1">
            <button
              type="submit"
              className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Save VAT registration
            </button>
          </div>
        )}
      </form>

      {/*
        * The threshold monitor.
        *
        * Not decoration: чл. 96 registration becomes mandatory above €51,130 of DOMESTIC turnover in
        * a CALENDAR year, and the application is due within seven days. The deadline starts with an
        * invoice, not with a date, so the only way to notice it in time is to watch invoices — which
        * is exactly what software is for and human memory is not.
        */}
      <div className="mt-4 border-t border-surface-border pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
            Domestic turnover {threshold.year}
          </h4>
          <span className="tnum text-[12px] text-ink-500">
            <span className="font-bold text-ink-900">{eur(threshold.turnoverMinor)}</span> of{" "}
            {eur(threshold.thresholdMinor)}
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            /*
             * The bar and the sentence beside it must agree.
             *
             * Caught by looking at the rendered page: at 78% the bar was green while the message
             * under it said registration was becoming mandatory. Colour is read first and words
             * second (`docs/UI-STANDARD.md` rule 2), so a green bar over an amber warning tells the
             * reader the opposite of the warning. Anything that has an advice line is now amber.
             */
            className={`h-full rounded-full ${
              informational
                ? "bg-ink-300"
                : threshold.band === "crossed"
                  ? "bg-danger-600"
                  : threshold.band === "close" || threshold.band === "approaching"
                    ? "bg-warning-600"
                    : "bg-success-600"
            }`}
            style={{ width: `${Math.max(pct, threshold.turnoverMinor > 0 ? 2 : 0)}%` }}
          />
        </div>

        {advice && (
          <p
            className={`mt-2 rounded-md px-3 py-2 text-[12px] leading-relaxed ${
              threshold.band === "crossed" ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700"
            }`}
          >
            {advice}
          </p>
        )}

        {informational && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
            Already registered under чл. 96, so this threshold no longer applies — the figure is here
            because it is worth knowing, not because anything needs doing.
          </p>
        )}

        {/*
          * How the number was reached, so it can be argued with rather than believed. Every figure on
          * a tax screen should be answerable to "which invoices is that?".
          */}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          Counts issued invoices to customers in {country}, excluding demo tenants. Sales to
          VAT-registered businesses elsewhere in the EU are supplied where the customer is
          (чл. 21, ал. 2) and do not count toward this threshold.{" "}
          {threshold.countedCount} counted · {threshold.excludedCount} not counted.
          {threshold.unknownCountryCount > 0 && (
            <>
              {" "}
              <span className="font-semibold text-warning-700">
                {threshold.unknownCountryCount} invoice
                {threshold.unknownCountryCount === 1 ? " has" : "s have"} no country on the customer, so
                {threshold.unknownCountryCount === 1 ? " it is" : " they are"} left out — fill the country in on the
                client page.
              </span>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
