import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's frame — navigation, account menu, property switcher, the connection line under the
 * nav. Same pattern as RevioCRS and RevioPMS: English is complete and authoritative; Bulgarian
 * follows the fixed glossary (`@revio/ui/i18n`, enforced by `scripts/terminology-lint.mjs`) —
 * канален мениджър, ценови план, наличност. Formal Вие.
 *
 * The screen names here are the ones RevioCRS already uses for RevioLink's screens ("RevioLink →
 * Съответствия", "→ Синхронизация"), so a hotel reads one name for one screen in both products.
 */
export interface ShellStrings {
  product: string;
  sections: { rates: string; channels: string; operations: string };
  /** Keyed by route, so a nav row and its label cannot be paired wrongly. */
  nav: Record<
    | "/dashboard" | "/calendar" | "/bulk-update" | "/rooms-rates" | "/channels" | "/mapping"
    | "/reservations" | "/sync" | "/help" | "/settings",
    string
  >;
  menu: { account: string; settings: string; logOut: string; language: string; openMenu: string; closeMenu: string };
  roles: Record<string, string>;
  search: string;
  switcher: { yourProperties: string };
  keep: { pending: string; label: string };
  /** The line under the nav that says what this hotel's connection really is. */
  connectivity: {
    none: string;
    live: (n: number) => string;
    mixed: (live: number, test: number) => string;
    sandbox: string;
    mock: string;
  };
}

export const shell: Translations<ShellStrings> = {
  en: {
    product: "Channel Manager",
    sections: { rates: "Rates & Availability", channels: "Channels", operations: "Operations" },
    nav: {
      "/dashboard": "Dashboard",
      "/calendar": "Calendar",
      "/bulk-update": "Bulk Rates & Restrictions",
      "/rooms-rates": "Rooms & Rates",
      "/channels": "Channels",
      "/mapping": "Mapping",
      "/reservations": "Reservations",
      "/sync": "Sync Center",
      "/help": "Help",
      "/settings": "Settings",
    },
    menu: { account: "Account menu", settings: "Settings", logOut: "Log out", language: "Language", openMenu: "Open menu", closeMenu: "Close menu" },
    roles: {
      owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr", distribution_manager: "Distribution", read_only: "Read-only",
      manager: "Manager", reception: "Reception", housekeeper: "Housekeeper", hk_supervisor: "Housekeeping lead",
      maintenance: "Maintenance", outlet_pos: "Outlet / POS",
    },
    search: "Search rooms, rates, channels, reservations…",
    switcher: { yourProperties: "Your properties" },
    keep: { pending: "Letting them know…", label: "I want to keep it" },
    connectivity: {
      none: "No channels connected",
      live: (n) => `Live · ${n} channel${n === 1 ? "" : "s"}`,
      mixed: (l, t) => `${l} live · ${t} in test`,
      sandbox: "Test connection (sandbox)",
      mock: "Test connection · nothing is sent to the OTAs",
    },
  },
  bg: {
    product: "Канален мениджър",
    sections: { rates: "Цени и наличност", channels: "Канали", operations: "Операции" },
    nav: {
      "/dashboard": "Табло",
      "/calendar": "Календар",
      "/bulk-update": "Масови промени",
      "/rooms-rates": "Стаи и цени",
      "/channels": "Канали",
      "/mapping": "Съответствия",
      "/reservations": "Резервации",
      "/sync": "Синхронизация",
      "/help": "Помощ",
      "/settings": "Настройки",
    },
    menu: { account: "Меню на профила", settings: "Настройки", logOut: "Изход", language: "Език", openMenu: "Отваряне на менюто", closeMenu: "Затваряне на менюто" },
    roles: {
      owner: "Собственик", admin: "Администратор", revenue_manager: "Приходи", distribution_manager: "Дистрибуция", read_only: "Само преглед",
      manager: "Управител", reception: "Рецепция", housekeeper: "Хаускийпинг", hk_supervisor: "Старши хаускийпинг",
      maintenance: "Поддръжка", outlet_pos: "Точка на продажба",
    },
    search: "Търсене на стаи, цени, канали, резервации…",
    switcher: { yourProperties: "Вашите обекти" },
    keep: { pending: "Уведомяваме ги…", label: "Искам да го запазя" },
    connectivity: {
      none: "Няма свързани канали",
      live: (n) => `Реална връзка · ${n} ${n === 1 ? "канал" : "канала"}`,
      mixed: (l, t) => `${l} реални · ${t} в тест`,
      sandbox: "Тестова връзка (sandbox)",
      mock: "Тестова връзка · нищо не се изпраща към OTA",
    },
  },
};
