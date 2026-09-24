import { renderSystemEmail, renderSystemEmailText, type SystemEmailLocale } from "./system-shell.js";
import type { AuthEmail } from "./auth-emails.js";

/**
 * The mail a hotel's own team gets from RevioLink — new channel bookings, and the arrivals list —
 * in the team's language (founder, 2026-09-25: *"ако панела е на български и вътрешните мейли към
 * персонала да са на български"*).
 *
 * ## One table per language, so the next language is an entry, not a branch
 *
 * The copy is a `Record<locale, …>` rather than `if (locale === "bg")`. Bulgarian is the first
 * translation and will not be the last; a new language here is one more entry that the type forces
 * to be complete, and nothing else in the file changes.
 */

type Words = {
  newPreview: string; newHeading: string; newHeadingOne: string; newLead: string; newSubject: string; newSubjectOne: string;
  today: string; tomorrow: string; arriving: string; noneToday: string; noneTomorrow: string; nights: string; direct: string;
};

const WORDS: Record<SystemEmailLocale, Words> = {
  en: {
    newPreview: "{n} new from {channel}.",
    newHeading: "{n} new bookings",
    newHeadingOne: "1 new booking",
    newLead: "Pulled from {channel} for {hotel}.",
    newSubject: "{n} new bookings — {hotel}",
    newSubjectOne: "1 new booking — {hotel}",
    today: "Today's arrivals",
    tomorrow: "Tomorrow's arrivals",
    arriving: "{n} arriving on {day}.",
    noneToday: "No arrivals today.",
    noneTomorrow: "No arrivals tomorrow.",
    nights: "{n}n",
    direct: "Direct",
  },
  bg: {
    newPreview: "{n} нови от {channel}.",
    newHeading: "{n} нови резервации",
    newHeadingOne: "1 нова резервация",
    newLead: "Изтеглени от {channel} за {hotel}.",
    newSubject: "{n} нови резервации — {hotel}",
    newSubjectOne: "1 нова резервация — {hotel}",
    today: "Пристигания днес",
    tomorrow: "Пристигания утре",
    arriving: "{n} пристигат на {day}.",
    noneToday: "Днес няма пристигания.",
    noneTomorrow: "Утре няма пристигания.",
    nights: "{n} нощ.",
    direct: "Директно",
  },
};

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const words = (l?: string): Words => WORDS[(l as SystemEmailLocale) in WORDS ? (l as SystemEmailLocale) : "en"];
const localeOf = (l?: string): SystemEmailLocale => ((l as SystemEmailLocale) in WORDS ? (l as SystemEmailLocale) : "en");

export interface StaffBookingRow {
  guest: string; room: string; checkIn: string; checkOut: string; channel: string | null;
  /** The channel's own reference, so it can be found on their extranet. */
  reference?: string | null;
  /** Formatted by the caller, in the booking's currency. */
  total?: string | null;
}

/** "3 new bookings" from a channel pull, for a hotel with no RevioCRS or RevioPMS to show them. */
export function newBookingsEmail(a: { locale?: string; hotel: string; channel: string; rows: StaffBookingRow[] }): AuthEmail {
  const w = words(a.locale);
  const n = a.rows.length;
  const args = {
    locale: localeOf(a.locale),
    preview: fill(w.newPreview, { n, channel: a.channel }),
    heading: n === 1 ? w.newHeadingOne : fill(w.newHeading, { n }),
    product: "RevioLink",
    blocks: [
      { p: fill(w.newLead, { channel: a.channel, hotel: a.hotel }) },
      {
        list: a.rows.map((r) =>
          `${r.reference ? `#${r.reference} · ` : ""}${r.guest} — ${r.room} · ${r.checkIn} → ${r.checkOut} · ${r.channel ?? w.direct}${r.total ? ` · ${r.total}` : ""}`,
        ),
      },
    ],
  };
  return {
    subject: n === 1 ? fill(w.newSubjectOne, { hotel: a.hotel }) : fill(w.newSubject, { n, hotel: a.hotel }),
    text: renderSystemEmailText(args),
    html: renderSystemEmail(args),
  };
}

export interface StaffArrivalRow { guest: string; room: string; nights: number; channel: string | null }

/** The daily arrivals list. `which` decides the heading; the audit trail keeps its own English label. */
export function arrivalsEmail(a: { locale?: string; which: "today" | "tomorrow"; hotel: string; day: string; rows: StaffArrivalRow[] }): AuthEmail {
  const w = words(a.locale);
  const label = a.which === "today" ? w.today : w.tomorrow;
  const none = a.which === "today" ? w.noneToday : w.noneTomorrow;
  const args = {
    locale: localeOf(a.locale),
    preview: a.rows.length > 0 ? `${fill(w.arriving, { n: a.rows.length, day: a.day })}` : none,
    heading: `${label} — ${a.hotel}`,
    product: "RevioLink",
    blocks: a.rows.length > 0
      ? [
          { p: fill(w.arriving, { n: a.rows.length, day: a.day }) },
          { list: a.rows.map((r) => `${r.guest} — ${r.room} · ${fill(w.nights, { n: r.nights })} · ${r.channel ?? w.direct}`) },
        ]
      : [{ p: `${none} (${a.day})` }],
  };
  return {
    subject: `${label} (${a.rows.length}) — ${a.hotel} · ${a.day}`,
    text: renderSystemEmailText(args),
    html: renderSystemEmail(args),
  };
}
