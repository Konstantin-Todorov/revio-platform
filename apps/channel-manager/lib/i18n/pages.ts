import type { Translations } from "@revio/ui/i18n";

/** RevioLink's status pages — errors, not-found, stale tabs. Other screens have their own dictionaries. */
export interface PagesStrings {
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
