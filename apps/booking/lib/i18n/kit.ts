import { LOCALE_LABELS, translate, type Locale } from "@revio/ui/i18n";
import { dateWords } from "@revio/ui/date-words";
import { roomContentStrings } from "@revio/ui/room-content-strings";
import { stayTermsWords, type StayTerms } from "@revio/core";
import { guest } from "./guest";

/** The cookie the language switcher writes. Read on the server by `serverKit`. A year: a guest's language does not change. */
export const GUEST_LANG_COOKIE = "revio_lang";

/**
 * Everything a screen needs to speak the guest's language: the words, the room-content labels, and
 * dates and money formatted for that language. One object so a component cannot mix an English
 * date into a Bulgarian sentence — which is what happens when the words and the formats are fetched
 * from two places.
 *
 * Pure: the server calls it with the negotiated locale (`serverKit`), a client component with the
 * provider's (`useGuestKit`). Dates go through `dateWords`, built so the server's and the browser's
 * ICU produce the same text and the page hydrates cleanly.
 */
export function guestKit(locale: Locale) {
  const d = dateWords(locale);
  const intl = LOCALE_LABELS[locale].intl;
  return {
    locale,
    s: translate(guest, locale),
    room: translate(roomContentStrings, locale),
    fmtDay: d.fmtDay,
    fmtDayLong: d.fmtDayLong,
    fmtMonth: d.fmtMonth,
    weekdays: d.weekdays,
    /** Minor units in; whole amounts without decimals ("€120"), the rest to the cent. */
    money: (minor: number, currency: string) =>
      new Intl.NumberFormat(intl, {
        style: "currency",
        currency,
        minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(minor / 100),
  };
}

/**
 * The rate's terms in the guest's words — the SAME sentences on the results, the card step and the
 * confirmation, because they come from one function with one set of numbers.
 */
export function termsWords(kit: GuestKit, t: StayTerms, currency: string) {
  return stayTermsWords(t, kit.locale === "bg" ? "bg" : "en", (m) => kit.money(m, currency), kit.fmtDay);
}

export type GuestKit = ReturnType<typeof guestKit>;
