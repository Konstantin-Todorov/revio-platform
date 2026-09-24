import { countryName } from "@revio/core";
import { LOCALE_LABELS, type Locale } from "@revio/ui/i18n";

/**
 * A country's name in the reader's language. English keeps the register's own list
 * (`countryName`); Bulgarian comes from the platform's CLDR data, which names every ISO code —
 * so a guest from a country the list does not name still reads "Япония" rather than "JP".
 */
export function countryIn(locale: Locale): (code: string | null | undefined) => string {
  if (locale === "en") return countryName;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([LOCALE_LABELS[locale].intl], { type: "region" });
  } catch {
    names = null; // a runtime without region data falls back to the English list, never to blank
  }
  return (code) => {
    if (!code) return "—";
    const k = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(k) || !names) return countryName(k);
    return names.of(k) ?? countryName(k);
  };
}
