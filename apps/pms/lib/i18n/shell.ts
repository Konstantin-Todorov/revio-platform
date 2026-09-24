import type { Translations } from "@revio/ui/i18n";

/**
 * RevioPMS's frame — navigation, account menu, roles. The first dictionary, and the pattern for the
 * rest: English is complete and authoritative; Bulgarian may lag and falls back per key.
 *
 * Terminology follows the fixed glossary (`@revio/ui/i18n` header, enforced by
 * `scripts/terminology-lint.mjs`): хаускийпинг, обект, наличност, ценови план. Formal Вие.
 */
export interface ShellStrings {
  sections: { frontOffice: string; roomsHousekeeping: string; setup: string; endOfDay: string };
  /** Keyed by route, so a nav row and its label cannot be paired wrongly. */
  nav: Record<
    | "/dashboard" | "/calendar" | "/guests" | "/folios" | "/register" | "/minibar"
    | "/housekeeping" | "/rooms" | "/maintenance" | "/users" | "/configuration" | "/closeday"
    | "/activity" | "/help" | "/settings",
    string
  >;
  businessDate: (date: string) => string;
  menu: { account: string; settings: string; logOut: string; language: string; openMenu: string; closeMenu: string };
  roles: Record<string, string>;
}

export const shell: Translations<ShellStrings> = {
  en: {
    sections: { frontOffice: "Front office", roomsHousekeeping: "Rooms & housekeeping", setup: "Setup", endOfDay: "End of day" },
    nav: {
      "/dashboard": "Front Desk",
      "/calendar": "Calendar",
      "/guests": "Guests",
      "/folios": "Folios & Billing",
      "/register": "Guest Register",
      "/minibar": "Extras & Charges",
      "/housekeeping": "Housekeeping",
      "/rooms": "Rooms",
      "/maintenance": "Maintenance",
      "/users": "Staff & Access",
      "/configuration": "Configuration",
      "/closeday": "Close Day",
      "/activity": "Activity",
      "/help": "Help",
      "/settings": "Settings",
    },
    businessDate: (date) => `Business date · ${date}`,
    menu: { account: "Account menu", settings: "Settings", logOut: "Log out", language: "Language", openMenu: "Open menu", closeMenu: "Close menu" },
    roles: {
      owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr", distribution_manager: "Distribution", read_only: "Read-only",
      manager: "Manager", reception: "Reception", housekeeper: "Housekeeper", hk_supervisor: "Housekeeping lead",
      maintenance: "Maintenance", outlet_pos: "Outlet / POS",
    },
  },
  bg: {
    sections: { frontOffice: "Рецепция", roomsHousekeeping: "Стаи и хаускийпинг", setup: "Настройка", endOfDay: "Край на деня" },
    nav: {
      "/dashboard": "Рецепция",
      "/calendar": "Календар",
      "/guests": "Гости",
      "/folios": "Сметки и плащания",
      "/register": "Регистър на гостите",
      "/minibar": "Екстри и такси",
      "/housekeeping": "Хаускийпинг",
      "/rooms": "Стаи",
      "/maintenance": "Поддръжка",
      "/users": "Персонал и достъп",
      "/configuration": "Конфигурация",
      "/closeday": "Затваряне на деня",
      "/activity": "Активност",
      "/help": "Помощ",
      "/settings": "Настройки",
    },
    businessDate: (date) => `Работна дата · ${date}`,
    menu: { account: "Меню на профила", settings: "Настройки", logOut: "Изход", language: "Език", openMenu: "Отваряне на менюто", closeMenu: "Затваряне на менюто" },
    roles: {
      owner: "Собственик", admin: "Администратор", revenue_manager: "Приходи", distribution_manager: "Дистрибуция", read_only: "Само преглед",
      manager: "Управител", reception: "Рецепция", housekeeper: "Хаускийпинг", hk_supervisor: "Старши хаускийпинг",
      maintenance: "Поддръжка", outlet_pos: "Точка на продажба",
    },
  },
};
