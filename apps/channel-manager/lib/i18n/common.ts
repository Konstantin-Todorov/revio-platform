import type { Translations } from "@revio/ui/i18n";

/** Words several RevioLink screens share — the confirm-then-delete dialog, and why an action refused. */
export interface CmCommonStrings {
  deleteDialog: {
    aria: (label: string) => string;
    title: (label: string) => string;
    /** The sentence around the bold name: [before, after]. */
    removes: [string, string];
    cancel: string;
    delete: string;
  };
  /** The close button on every dialog. */
  close: string;
  /** One-line refusals and confirmations from support, trials and guest emails. */
  flash: {
    supportExpired: string;
    requestUnknown: string;
    unknownProduct: string;
    noTrial: string;
    emailLookSaved: string;
  };
  /** Why an action refused — `lib/authz.ts`. `what` is keyed by `Capability`; core's English is held to it by a drift test. */
  authz: {
    expired: string;
    switchedOff: string;
    readOnly: (what: string) => string;
    cannot: (what: string) => string;
    what: Record<"manageStaff" | "manageSettings" | "manageRates" | "manageInventory" | "manageDistribution" | "manageReservations" | "manageSubscription", string>;
  };
}

export const common: Translations<CmCommonStrings> = {
  en: {
    deleteDialog: {
      aria: (l) => `Delete ${l}`,
      title: (l) => `Delete ${l}?`,
      removes: ["This removes ", " and its prices, calendar cells and channel mappings."],
      cancel: "Cancel",
      delete: "Delete",
    },
    close: "Close",
    flash: {
      supportExpired: "Your session has expired. Sign in again and send it once more.",
      requestUnknown: "That request could not be identified. Reload the page.",
      unknownProduct: "Unknown product.",
      noTrial: "There is no trial running here to keep. Reload the page — it may have finished already.",
      emailLookSaved: "Saved — every guest email now carries this look.",
    },
    authz: {
      expired: "Your session has expired. Sign in again.",
      switchedOff: "RevioLink is switched off for this hotel, so this change was not saved. Nothing has been deleted — reload to see where it stands.",
      readOnly: (w) => `Your account has read-only access, so it cannot ${w}. Ask an owner or admin at your property to change your role.`,
      cannot: (w) => `Your account cannot ${w}. Ask an owner or admin at your property if you need to.`,
      what: {
        manageStaff: "manage staff accounts", manageSettings: "change property settings", manageRates: "change rates or restrictions",
        manageInventory: "change availability", manageDistribution: "change channel connections",
        manageReservations: "create or change reservations", manageSubscription: "start or keep a product on this account",
      },
    },
  },
  bg: {
    deleteDialog: {
      aria: (l) => `Изтрий ${l}`,
      title: (l) => `Изтриване на ${l}?`,
      removes: ["Това премахва ", " заедно с цените, клетките в календара и връзките с каналите."],
      cancel: "Отказ",
      delete: "Изтрий",
    },
    close: "Затвори",
    flash: {
      supportExpired: "Сесията Ви е изтекла. Влезте отново и изпратете още веднъж.",
      requestUnknown: "Заявката не можа да бъде разпозната. Презаредете страницата.",
      unknownProduct: "Непознат продукт.",
      noTrial: "Тук няма активен пробен период, който да се запази. Презаредете страницата — може вече да е приключил.",
      emailLookSaved: "Запазено — всеки имейл до гостите вече е с този вид.",
    },
    authz: {
      expired: "Сесията Ви е изтекла. Влезте отново.",
      switchedOff: "RevioLink е изключен за този хотел, затова промяната не е запазена. Нищо не е изтрито — презаредете, за да видите състоянието.",
      readOnly: (w) => `Профилът Ви е само за преглед, затова не може да ${w}. Помолете собственик или администратор на обекта да промени ролята Ви.`,
      cannot: (w) => `Профилът Ви не може да ${w}. Ако Ви трябва, помолете собственик или администратор на обекта.`,
      what: {
        manageStaff: "управлява служителски профили", manageSettings: "променя настройките на обекта", manageRates: "променя цени или ограничения",
        manageInventory: "променя наличността", manageDistribution: "променя връзките с каналите",
        manageReservations: "създава или променя резервации", manageSubscription: "стартира или запазва продукт в този акаунт",
      },
    },
  },
};
