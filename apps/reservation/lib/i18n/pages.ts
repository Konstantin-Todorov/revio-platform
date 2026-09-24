import type { Translations } from "@revio/ui/i18n";

/**
 * The small screens: search, the activity header, the command palette's rows and the status pages.
 *
 * `status` is **strings only** — `error.tsx` is a client component (Next requires it) and reads it
 * with `translate(pages, useLocale())`.
 */
export interface PagesStrings {
  search: {
    title: string;
    results: (q: string) => string;
    subtitle: (property: string, n: number) => string;
    nothing: string;
    prompt: string;
    nothingBody: string;
    promptBody: string;
    cols: { guest: string; contact: string; stay: string; room: string; source: string; total: string; status: string };
  };
  activity: {
    title: string;
    subtitle: (n: number) => string;
    changes: string;
    changesSub: (from: string, to: string) => string;
    automaticNote: string;
  };
  palette: {
    reservation: string;
    guest: string;
    noNights: string;
    forwardingOnly: string;
    noContact: string;
    rooms: (n: number) => string;
    ratePlan: string;
    inactive: string;
    /** Keyed by route — the titles come from the sidebar's own names (shell.nav). */
    subs: Record<string, string>;
  };
  status: {
    errorTitle: string;
    errorBody: string;
    tryAgain: string;
    backToDashboard: string;
    updatedTitle: string;
    updatedBody: string;
    reload: string;
    pageNotFound: string;
    pageNotFoundBody: string;
    goToProduct: string;
    pageDidntLoad: string;
  };
}

export const pages: Translations<PagesStrings> = {
  en: {
    search: {
      title: "Global Search",
      results: (q) => `Search: “${q}”`,
      subtitle: (p, n) => `${p} · ${n} reservation${n === 1 ? "" : "s"} found — searches guest, phone, email, company, room, channel, source and status`,
      nothing: "Nothing matches",
      prompt: "Type a search above",
      nothingBody: "Try a guest name, phone number, e-mail, room type, channel or a status like “cancelled”.",
      promptBody: "The topbar search finds reservations from anywhere in the app.",
      cols: { guest: "Guest", contact: "Contact", stay: "Stay", room: "Room", source: "Source", total: "Total", status: "Status" },
    },
    activity: {
      title: "Activity",
      subtitle: (n) => `${n} change${n === 1 ? "" : "s"} · who changed what, and when`,
      changes: "Changes",
      changesSub: (f, t) => `${f} → ${t} · newest first · one history for this property, whichever product wrote it`,
      automaticNote: "channel syncs the software made by itself. They have their own screen in RevioLink.",
    },
    palette: {
      reservation: "Reservation",
      guest: "Guest",
      noNights: "no nights",
      forwardingOnly: "channel forwarding address only",
      noContact: "no contact details",
      rooms: (n) => `${n} room${n === 1 ? "" : "s"}`,
      ratePlan: "rate plan",
      inactive: "inactive",
      subs: {
        "/dashboard": "Today, the action centre and the forecast",
        "/reservations": "Every booking, from any source",
        "/waitlist": "Guests waiting on a sold-out date",
        "/guests": "Profiles, history and notes",
        "/inventory": "Availability by room type and date",
        "/rooms-rates": "Room types, photos, rate plans, closures",
        "/bulk": "Mass edits across dates and rooms",
        "/reports": "Occupancy, ADR, RevPAR and reports",
        "/distribution": "Channels and cost of distribution",
        "/booking-engine": "Your own booking page and its branding",
        "/settings": "Property, team, taxes, billing",
      },
    },
    status: {
      errorTitle: "This screen didn’t load",
      errorBody: "Something went wrong on our side. Your data is safe — nothing was changed. Try again, and if it keeps happening send us the reference below.",
      tryAgain: "Try again",
      backToDashboard: "Back to the dashboard",
      updatedTitle: "RevioCRS was just updated",
      updatedBody: "This page was open while a new version went out. Reloading picks it up — nothing you entered has been lost.",
      reload: "Reload the page",
      pageNotFound: "Page not found",
      pageNotFoundBody: "That address doesn’t exist in RevioCRS. If you followed a link from us, let us know.",
      goToProduct: "Go to RevioCRS",
      pageDidntLoad: "This page didn’t load",
    },
  },
  bg: {
    search: {
      title: "Търсене",
      results: (q) => `Търсене: „${q}“`,
      subtitle: (p, n) => `${p} · ${n} ${n === 1 ? "намерена резервация" : "намерени резервации"} — търси по гост, телефон, имейл, фирма, стая, канал, източник и статус`,
      nothing: "Няма съвпадения",
      prompt: "Въведете търсене горе",
      nothingBody: "Опитайте с име на гост, телефон, имейл, тип стая, канал или статус като „анулирана“.",
      promptBody: "Търсачката в горната лента намира резервации от всеки екран.",
      cols: { guest: "Гост", contact: "Контакт", stay: "Престой", room: "Стая", source: "Източник", total: "Общо", status: "Статус" },
    },
    activity: {
      title: "Активност",
      subtitle: (n) => `${n} ${n === 1 ? "промяна" : "промени"} · кой какво е променил и кога`,
      changes: "Промени",
      changesSub: (f, t) => `${f} → ${t} · най-новите първо · една история за обекта, от който и продукт да идва`,
      automaticNote: "синхронизации с каналите, направени от системата сама. Те имат свой екран в RevioLink.",
    },
    palette: {
      reservation: "Резервация",
      guest: "Гост",
      noNights: "без нощувки",
      forwardingOnly: "само адрес за препращане от канала",
      noContact: "няма данни за контакт",
      rooms: (n) => `${n} ${n === 1 ? "стая" : "стаи"}`,
      ratePlan: "ценови план",
      inactive: "неактивен",
      subs: {
        "/dashboard": "Днес, задачите за действие и прогнозата",
        "/reservations": "Всяка резервация, от всеки източник",
        "/waitlist": "Гости, които чакат разпродадена дата",
        "/guests": "Профили, история и бележки",
        "/inventory": "Наличност по тип стая и дата",
        "/rooms-rates": "Типове стаи, снимки, ценови планове, затваряния",
        "/bulk": "Масови промени по дати и стаи",
        "/reports": "Заетост, ADR, RevPAR и отчети",
        "/distribution": "Канали и цена на дистрибуцията",
        "/booking-engine": "Вашата страница за резервации и нейният облик",
        "/settings": "Обект, екип, данъци, абонамент",
      },
    },
    status: {
      errorTitle: "Този екран не се зареди",
      errorBody: "Нещо се обърка при нас. Данните Ви са в безопасност — нищо не е променено. Опитайте отново, а ако се повтаря, изпратете ни номера по-долу.",
      tryAgain: "Опитай отново",
      backToDashboard: "Обратно към таблото",
      updatedTitle: "RevioCRS току-що беше обновен",
      updatedBody: "Страницата е била отворена, докато излизаше нова версия. Презареждането я зарежда — нищо въведено не е загубено.",
      reload: "Презареди страницата",
      pageNotFound: "Страницата не е намерена",
      pageNotFoundBody: "Този адрес не съществува в RevioCRS. Ако сте последвали връзка от нас, моля, кажете ни.",
      goToProduct: "Към RevioCRS",
      pageDidntLoad: "Страницата не се зареди",
    },
  },
};
