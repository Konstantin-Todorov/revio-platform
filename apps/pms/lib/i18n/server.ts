import "server-only";
import { formatDay, LOCALE_LABELS, translate, type Locale, type Translations } from "@revio/ui/i18n";
import { getLocale } from "../locale";
import { money as moneyEn } from "../format";

/**
 * Everything a server-rendered screen needs to speak the reader's language, resolved once:
 *
 *     const { t, money, day, locale } = await i18n();
 *     const s = t(frontdesk);
 *
 * `money` and `day` exist so a translated sentence never carries an English-formatted number —
 * "Дължи €120.00" reads as a bug; "Дължи 120,00 €" does not.
 */
export async function i18n(): Promise<{
  locale: Locale;
  t: <T>(dict: Translations<T>) => T;
  money: (minor: number, currency?: string) => string;
  day: (isoDate: string, style?: "short" | "long") => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: (dict) => translate(dict, locale),
    // English keeps its exact current form ("€120", "€120.50"); Bulgarian follows the same rule —
    // whole amounts without decimals — in its own notation ("120 €", "120,50 €").
    money: (minor, currency = "EUR") =>
      locale === "en"
        ? moneyEn(minor, currency)
        : new Intl.NumberFormat(LOCALE_LABELS[locale].intl, {
            style: "currency", currency,
            minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
          }).format(minor / 100),
    day: (isoDate, style = "short") => formatDay(isoDate, locale, style),
  };
}
