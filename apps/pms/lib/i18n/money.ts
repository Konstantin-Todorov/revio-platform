import { LOCALE_LABELS, type Locale } from "@revio/ui/i18n";
import { money as moneyEn } from "../format";

/**
 * Money in the reader's language — pure, so a client component can use it with `useLocale()` and a
 * server component gets the same result through `i18n()`.
 *
 * English keeps its exact current form ("€120", "€120.50"); Bulgarian follows the same rule —
 * whole amounts without decimals — in its own notation ("120 €", "120,50 €").
 */
export function moneyIn(locale: Locale): (minor: number, currency?: string) => string {
  return (minor, currency = "EUR") =>
    locale === "en"
      ? moneyEn(minor, currency)
      : new Intl.NumberFormat(LOCALE_LABELS[locale].intl, {
          style: "currency", currency,
          minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
        }).format(minor / 100);
}
