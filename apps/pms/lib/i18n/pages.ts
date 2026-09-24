import type { Translations } from "@revio/ui/i18n";

/**
 * The small screens: help's tabs, search, the activity header and the two status pages.
 *
 * `status` is **strings only** — `error.tsx` is a client component (Next requires it) and reads it
 * with `translate(pages, useLocale())`.
 */
export interface PagesStrings {
  help: { aria: string; help: string; requests: (n: number) => string; open: (n: number) => string };
  search: {
    title: string;
    results: (q: string) => string;
    prompt: string;
    empty: string;
    nothing: (q: string) => string;
    rooms: string;
    reservations: string;
    guests: string;
    folio: string;
  };
  activity: {
    title: string;
    subtitle: (n: number) => string;
    changes: string;
    changesSub: (from: string, to: string) => string;
    automaticNote: string;
  };
  status: {
    errorTitle: string;
    errorBody: string;
    tryAgain: string;
    backToDesk: string;
    notFoundTitle: string;
    notFoundBody: string;
  };
}

export const pages: Translations<PagesStrings> = {
  en: {
    help: {
      aria: "Help sections",
      help: "Help",
      requests: (n) => (n === 0 ? "Your requests" : `Your requests (${n})`),
      open: (n) => `${n} open`,
    },
    search: {
      title: "Search",
      results: (q) => `Results for “${q}”`,
      prompt: "Search rooms, guests and reservations",
      empty: "Type in the search bar above to find a room, a guest, or a reservation.",
      nothing: (q) => `Nothing found for “${q}”.`,
      rooms: "Rooms",
      reservations: "Reservations",
      guests: "Guests",
      folio: "Folio →",
    },
    activity: {
      title: "Activity",
      subtitle: (n) => `${n} change${n === 1 ? "" : "s"} · who did what, and when`,
      changes: "Changes",
      changesSub: (f, t) => `${f} → ${t} · newest first`,
      automaticNote: "channel syncs the software made by itself. They have their own screen in RevioLink.",
    },
    status: {
      errorTitle: "This screen didn’t load",
      errorBody: "Something went wrong on our side. Your data is safe — nothing was changed. Try again, and if it keeps happening send us the reference below.",
      tryAgain: "Try again",
      backToDesk: "Back to Front Desk",
      notFoundTitle: "We couldn’t find that",
      notFoundBody: "The page or record you’re looking for doesn’t exist, or it may have been removed. Check the link, or start again from the menu.",
    },
  },
  bg: {
    help: {
      aria: "Раздели на помощта",
      help: "Помощ",
      requests: (n) => (n === 0 ? "Вашите запитвания" : `Вашите запитвания (${n})`),
      open: (n) => `${n} ${n === 1 ? "отворено" : "отворени"}`,
    },
    search: {
      title: "Търсене",
      results: (q) => `Резултати за „${q}“`,
      prompt: "Търсене на стаи, гости и резервации",
      empty: "Пишете в полето за търсене горе, за да намерите стая, гост или резервация.",
      nothing: (q) => `Нищо не е намерено за „${q}“.`,
      rooms: "Стаи",
      reservations: "Резервации",
      guests: "Гости",
      folio: "Сметка →",
    },
    activity: {
      title: "Активност",
      subtitle: (n) => `${n} ${n === 1 ? "промяна" : "промени"} · кой какво е направил и кога`,
      changes: "Промени",
      changesSub: (f, t) => `${f} → ${t} · най-новите първо`,
      automaticNote: "синхронизации с каналите, направени от системата сама. Те имат свой екран в RevioLink.",
    },
    status: {
      errorTitle: "Този екран не се зареди",
      errorBody: "Нещо се обърка при нас. Данните Ви са в безопасност — нищо не е променено. Опитайте отново и ако продължава, изпратете ни кода по-долу.",
      tryAgain: "Опитайте отново",
      backToDesk: "Обратно към рецепцията",
      notFoundTitle: "Не намерихме това",
      notFoundBody: "Страницата или записът, който търсите, не съществува или е премахнат. Проверете връзката или започнете отново от менюто.",
    },
  },
};
