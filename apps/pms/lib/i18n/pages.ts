import type { Translations } from "@revio/ui/i18n";

/**
 * The small screens: search, the activity header and the two status pages.
 *
 * `status` is **strings only** — `error.tsx` is a client component (Next requires it) and reads it
 * with `translate(pages, useLocale())`.
 */
export interface PagesStrings {
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
  palette: {
    reservation: string;
    guest: string;
    departed: string;
    noNights: string;
    forwardingOnly: string;
    noContact: string;
    floor: (f: string) => string;
    /** Keyed by route — the page titles themselves come from the sidebar's own names (shell.nav). */
    subs: Record<string, string>;
  };
  status: {
    errorTitle: string;
    errorBody: string;
    tryAgain: string;
    backToDesk: string;
    notFoundTitle: string;
    notFoundBody: string;
    updatedTitle: string;
    updatedBody: string;
    reload: string;
    pageNotFound: string;
    pageNotFoundBody: string;
    goToPms: string;
    pageDidntLoad: string;
  };
  wrongProperty: {
    title: (guest: string, property: string) => string;
    thatBooking: string;
    body: string;
    switchTo: (property: string) => string;
    stay: string;
  };
}

export const pages: Translations<PagesStrings> = {
  en: {
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
    palette: {
      reservation: "Reservation",
      guest: "Guest",
      departed: "departed",
      noNights: "no nights",
      forwardingOnly: "channel forwarding address only",
      noContact: "no contact details",
      floor: (f) => `floor ${f}`,
      subs: {
        "/dashboard": "Arrivals, departures, in-house",
        "/calendar": "Reservations by room and date",
        "/guests": "Profiles, identity and preferences",
        "/folios": "Open folios, charges and invoices",
        "/register": "The statutory register of who stayed",
        "/minibar": "Minibar, outlets and tap-to-post",
        "/housekeeping": "Room status, assignments and inspection",
        "/rooms": "Units, floors, beds and occupancy",
        "/maintenance": "Faults, crew and out-of-order rooms",
        "/users": "Roster, roles and clock-in",
        "/configuration": "Property setup and operational rules",
        "/closeday": "The night audit",
        "/help": "Ask us anything",
      },
    },
    status: {
      errorTitle: "This screen didn’t load",
      errorBody: "Something went wrong on our side. Your data is safe — nothing was changed. Try again, and if it keeps happening send us the reference below.",
      tryAgain: "Try again",
      backToDesk: "Back to Front Desk",
      notFoundTitle: "We couldn’t find that",
      notFoundBody: "The page or record you’re looking for doesn’t exist, or it may have been removed. Check the link, or start again from the menu.",
      updatedTitle: "RevioPMS was just updated",
      updatedBody: "This page was open while a new version went out. Reloading picks it up — nothing you entered has been lost.",
      reload: "Reload the page",
      pageNotFound: "Page not found",
      pageNotFoundBody: "That address doesn’t exist in RevioPMS. If you followed a link from us, let us know.",
      goToPms: "Go to RevioPMS",
      pageDidntLoad: "This page didn’t load",
    },
    wrongProperty: {
      title: (g, p) => `${g} is at ${p}`,
      thatBooking: "That booking",
      body: "You are working in a different hotel right now, so this booking cannot be opened here. Switching takes you straight to it — everything else moves with you.",
      switchTo: (p) => `Switch to ${p}`,
      stay: "Stay here",
    },
  },
  bg: {
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
    palette: {
      reservation: "Резервация",
      guest: "Гост",
      departed: "напуснал",
      noNights: "без нощувки",
      forwardingOnly: "само адрес за препращане от канала",
      noContact: "няма данни за контакт",
      floor: (f) => `етаж ${f}`,
      subs: {
        "/dashboard": "Пристигания, напускания, гости в хотела",
        "/calendar": "Резервации по стая и дата",
        "/guests": "Профили, самоличност и предпочитания",
        "/folios": "Отворени сметки, начисления и фактури",
        "/register": "Задължителният регистър на нощувалите",
        "/minibar": "Минибар, точки на продажба и бързо начисляване",
        "/housekeeping": "Състояние на стаите, разпределение и проверка",
        "/rooms": "Стаи, етажи, легла и капацитет",
        "/maintenance": "Повреди, екип и стаи извън експлоатация",
        "/users": "Смени, роли и начало на смяна",
        "/configuration": "Настройки на обекта и оперативни правила",
        "/closeday": "Нощният одит",
        "/help": "Попитайте ни каквото и да е",
      },
    },
    status: {
      errorTitle: "Този екран не се зареди",
      errorBody: "Нещо се обърка при нас. Данните Ви са в безопасност — нищо не е променено. Опитайте отново и ако продължава, изпратете ни кода по-долу.",
      tryAgain: "Опитайте отново",
      backToDesk: "Обратно към рецепцията",
      notFoundTitle: "Не намерихме това",
      notFoundBody: "Страницата или записът, който търсите, не съществува или е премахнат. Проверете връзката или започнете отново от менюто.",
      updatedTitle: "RevioPMS току-що беше обновен",
      updatedBody: "Страницата е била отворена, докато излизаше нова версия. Презареждането я зарежда — нищо въведено не е изгубено.",
      reload: "Презареди страницата",
      pageNotFound: "Страницата не е намерена",
      pageNotFoundBody: "Този адрес не съществува в RevioPMS. Ако сте стигнали тук по връзка от нас, моля, кажете ни.",
      goToPms: "Към RevioPMS",
      pageDidntLoad: "Страницата не се зареди",
    },
    wrongProperty: {
      title: (g, p) => `${g} е в ${p}`,
      thatBooking: "Тази резервация",
      body: "В момента работите в друг хотел, затова резервацията не може да се отвори тук. Превключването Ви отвежда директно при нея — всичко останало се премества с Вас.",
      switchTo: (p) => `Превключи към ${p}`,
      stay: "Остани тук",
    },
  },
};
