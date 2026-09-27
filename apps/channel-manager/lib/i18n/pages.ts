import type { Translations } from "@revio/ui/i18n";

/** RevioLink's status pages — errors, not-found, stale tabs — and the ⌘K palette's rows. */
export interface PagesStrings {
  palette: {
    reservation: string;
    direct: string;
    arrived: (day: string) => string;
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
    /** In-shell 404: a record that no longer exists. */
    recordNotFound: string;
    recordNotFoundBody: string;
    goToProduct: string;
    pageDidntLoad: string;
  };
}

export const pages: Translations<PagesStrings> = {
  en: {
    palette: {
      reservation: "Reservation",
      direct: "direct",
      arrived: (d) => `arrived ${d}`,
      rooms: (n) => `${n} room${n === 1 ? "" : "s"}`,
      ratePlan: "rate plan",
      inactive: "inactive",
      subs: {
        "/calendar": "Availability, rates and restrictions",
        "/bulk-update": "Mass edits across dates and rooms",
        "/rooms-rates": "Room types, rate plans, linkage",
        "/channels": "Connected channels and settings",
        "/mapping": "Match your products to the channel's",
        "/reservations": "Everything pulled from the channels",
        "/sync": "Pushes, pulls and what failed",
        "/settings": "Property, team, billing",
      },
    },
    status: {
      errorTitle: "This screen didn’t load",
      errorBody: "Something went wrong on our side. Your data is safe — nothing was changed. Try again, and if it keeps happening send us the reference below.",
      tryAgain: "Try again",
      backToDashboard: "Back to the dashboard",
      updatedTitle: "RevioLink was just updated",
      updatedBody: "This page was open while a new version went out. Reloading picks it up — nothing you entered has been lost.",
      reload: "Reload the page",
      pageNotFound: "Page not found",
      pageNotFoundBody: "That address doesn’t exist in RevioLink. If you followed a link from us, let us know.",
      recordNotFound: "We couldn’t find that",
      recordNotFoundBody: "The page or record you’re looking for doesn’t exist, or it may have been removed. Check the link, or start again from the menu.",
      goToProduct: "Go to RevioLink",
      pageDidntLoad: "This page didn’t load",
    },
  },
  bg: {
    palette: {
      reservation: "Резервация",
      direct: "директно",
      arrived: (d) => `пристигнала ${d}`,
      rooms: (n) => `${n} ${n === 1 ? "стая" : "стаи"}`,
      ratePlan: "ценови план",
      inactive: "неактивен",
      subs: {
        "/calendar": "Наличност, цени и ограничения",
        "/bulk-update": "Масови промени по дати и стаи",
        "/rooms-rates": "Типове стаи, ценови планове, връзки",
        "/channels": "Свързани канали и настройки",
        "/mapping": "Свържете продуктите си с тези на канала",
        "/reservations": "Всичко, изтеглено от каналите",
        "/sync": "Изпращания, изтегляния и какво не успя",
        "/settings": "Обект, екип, плащания",
      },
    },
    status: {
      errorTitle: "Този екран не се зареди",
      errorBody: "Нещо се обърка при нас. Данните Ви са в безопасност — нищо не е променено. Опитайте отново, а ако се повтаря, изпратете ни номера по-долу.",
      tryAgain: "Опитай отново",
      backToDashboard: "Обратно към таблото",
      updatedTitle: "RevioLink току-що беше обновен",
      updatedBody: "Страницата е била отворена, докато излизаше нова версия. Презареждането я зарежда — нищо въведено не е загубено.",
      reload: "Презареди страницата",
      pageNotFound: "Страницата не е намерена",
      pageNotFoundBody: "Този адрес не съществува в RevioLink. Ако сте последвали връзка от нас, моля, кажете ни.",
      recordNotFound: "Не можахме да го намерим",
      recordNotFoundBody: "Страницата или записът, който търсите, не съществува или е премахнат. Проверете линка или започнете отново от менюто.",
      goToProduct: "Към RevioLink",
      pageDidntLoad: "Страницата не се зареди",
    },
  },
};
