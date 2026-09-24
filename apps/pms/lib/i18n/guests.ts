import type { Translations } from "@revio/ui/i18n";

/**
 * Strings the guest list's client table needs. **Strings only** — it crosses to a client component.
 */
export interface GuestsTableStrings {
  search: string;
  /** "{shown} of {total}" */
  count: string;
  cols: { guest: string; stays: string; nights: string; ancillary: string; lifetime: string; last: string };
  /** "No guests match “{q}”." */
  noMatch: string;
}

/** The guest list and the operational guest profile. */
export interface GuestsStrings {
  title: string;
  subtitle: (property: string) => string;
  withStay: (n: number) => string;
  none: string;
  table: GuestsTableStrings;
  profile: {
    back: string;
    subtitle: (stays: number, nights: number) => string;
    duplicates: (n: number) => string;
    dupReason: Record<"email" | "phone" | "name", string>;
    merge: string;
    mergeNote: string;
    stats: {
      lifetime: string;
      lifetimeHint: string;
      avgNightly: string;
      avgNightlyHint: string;
      avgAncillary: string;
      avgAncillaryHint: string;
      ancillaryLifetime: string;
      ancillaryLifetimeHint: string;
    };
    preferences: string;
    preferencesSub: string;
    notEnough: string;
    preferredRoom: string;
    preferredFloor: string;
    favourites: string;
    noFavourites: string;
    notes: string;
    notesSub: string;
    noNotes: string;
    history: (n: number) => string;
    cols: { reservation: string; stay: string; roomType: string; source: string; total: string; status: string };
    statuses: Record<string, string>;
  };
}

export const guests: Translations<GuestsStrings> = {
  en: {
    title: "Guests",
    subtitle: (p) => `${p} · profiles built from each guest's bills, purchases and room history`,
    withStay: (n) => `Guests with a stay here (${n})`,
    none: "No guests with a stay at this property yet.",
    table: {
      search: "Search by name or email…",
      count: "{shown} of {total}",
      cols: { guest: "Guest", stays: "Stays", nights: "Nights", ancillary: "Ancillary spend", lifetime: "Lifetime", last: "Last stay" },
      noMatch: "No guests match “{q}”.",
    },
    profile: {
      back: "Guests",
      subtitle: (s, n) => `${s} stay${s === 1 ? "" : "s"} · ${n} nights · operational profile`,
      duplicates: (n) => `${n} possible duplicate${n === 1 ? "" : "s"} — likely the same guest across bookings`,
      dupReason: { email: "same email", phone: "same phone", name: "same name" },
      merge: "Merge into this guest",
      mergeNote: "Merging re-points the other record’s stays and notes here and can’t leave a stray duplicate behind. Nothing is deleted.",
      stats: {
        lifetime: "Lifetime value",
        lifetimeHint: "room + ancillary",
        avgNightly: "Avg nightly spend",
        avgNightlyHint: "accommodation ÷ nights",
        avgAncillary: "Avg ancillary / stay",
        avgAncillaryHint: "minibar + extras",
        ancillaryLifetime: "Ancillary lifetime",
        ancillaryLifetimeHint: "POS consumption",
      },
      preferences: "Preferences",
      preferencesSub: "From the rooms they've had and what they've bought",
      notEnough: "Not enough history yet — preferences appear after a 2nd stay (a single stay isn’t a reliable “usual”).",
      preferredRoom: "Preferred room",
      preferredFloor: "Preferred floor",
      favourites: "Favourite items",
      noFavourites: "Nothing bought on a previous stay yet.",
      notes: "Requests & notes",
      notesSub: "Standing requests + per-stay notes",
      noNotes: "No requests or notes on record. A structured complaint/issue log arrives with maintenance linkage (future).",
      history: (n) => `Stay history (${n})`,
      cols: { reservation: "Reservation", stay: "Stay", roomType: "Room type", source: "Source", total: "Total", status: "Status" },
      statuses: {
        confirmed: "confirmed", modified: "modified", checked_in: "checked in", checked_out: "checked out",
        cancelled: "cancelled", no_show: "no show", hold: "hold",
      },
    },
  },
  bg: {
    title: "Гости",
    subtitle: (p) => `${p} · профили, изградени от сметките, покупките и стаите на всеки гост`,
    withStay: (n) => `Гости с престой тук (${n})`,
    none: "Все още няма гости с престой в този обект.",
    table: {
      search: "Търсене по име или имейл…",
      count: "{shown} от {total}",
      cols: { guest: "Гост", stays: "Престои", nights: "Нощувки", ancillary: "Екстри", lifetime: "Общо", last: "Последен престой" },
      noMatch: "Няма гости за „{q}“.",
    },
    profile: {
      back: "Гости",
      subtitle: (s, n) => `${s} ${s === 1 ? "престой" : "престоя"} · ${n} ${n === 1 ? "нощувка" : "нощувки"} · оперативен профил`,
      duplicates: (n) => `${n} ${n === 1 ? "възможен дубликат" : "възможни дубликата"} — вероятно същият гост в различни резервации`,
      dupReason: { email: "същия имейл", phone: "същия телефон", name: "същото име" },
      merge: "Обедини с този гост",
      mergeNote: "Обединяването прехвърля престоите и бележките от другия запис тук и не оставя дубликат. Нищо не се изтрива.",
      stats: {
        lifetime: "Обща стойност",
        lifetimeHint: "нощувки + допълнителни",
        avgNightly: "Средно на нощувка",
        avgNightlyHint: "настаняване ÷ нощувки",
        avgAncillary: "Допълнителни / престой",
        avgAncillaryHint: "минибар + екстри",
        ancillaryLifetime: "Допълнителни общо",
        ancillaryLifetimeHint: "консумация",
      },
      preferences: "Предпочитания",
      preferencesSub: "От стаите, в които е бил, и от това, което е купувал",
      notEnough: "Все още няма достатъчно история — предпочитанията се появяват след втори престой (един престой не е надеждно „обичайно“).",
      preferredRoom: "Предпочитана стая",
      preferredFloor: "Предпочитан етаж",
      favourites: "Любими артикули",
      noFavourites: "Все още нищо не е купувано при предишен престой.",
      notes: "Желания и бележки",
      notesSub: "Постоянни желания + бележки към престоите",
      noNotes: "Няма записани желания или бележки. Структуриран дневник за оплаквания ще дойде заедно с връзката към поддръжката.",
      history: (n) => `История на престоите (${n})`,
      cols: { reservation: "Резервация", stay: "Престой", roomType: "Тип стая", source: "Източник", total: "Общо", status: "Статус" },
      statuses: {
        confirmed: "потвърдена", modified: "променена", checked_in: "настанен", checked_out: "напуснал",
        cancelled: "анулирана", no_show: "неявяване", hold: "задържана",
      },
    },
  },
};
