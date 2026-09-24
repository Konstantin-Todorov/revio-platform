import "server-only";
import { formatDay, translate, type Locale, type Translations } from "@revio/ui/i18n";
import { getLocale } from "../locale";
import { moneyIn } from "./money";

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
    money: moneyIn(locale),
    day: (isoDate, style = "short") => formatDay(isoDate, locale, style),
  };
}
