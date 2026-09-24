import type { Translations } from "@revio/ui/i18n";

/**
 * RevioCRS's frame — navigation, account menu, property switcher. Same pattern as RevioPMS: English
 * is complete and authoritative; Bulgarian follows the fixed glossary (`@revio/ui/i18n`, enforced by
 * `scripts/terminology-lint.mjs`) — обект, наличност, ценови план, канален мениджър. Formal Вие.
 *
 * Strings only where a client component reads it (it imports this module and calls `translate`).
 */
export interface ShellStrings {
  product: string;
  sections: { overview: string; bookings: string; inventory: string; distribution: string };
  /** Keyed by route, so a nav row and its label cannot be paired wrongly. */
  nav: Record<
    | "/dashboard" | "/reports" | "/reservations" | "/waitlist" | "/guests" | "/inventory" | "/rooms-rates"
    | "/bulk" | "/distribution" | "/booking-engine" | "/activity" | "/help" | "/settings",
    string
  >;
  menu: { account: string; yourAccount: string; logOut: string; language: string; openMenu: string; closeMenu: string };
  roles: Record<string, string>;
  search: string;
  switcher: { yourProperties: string; allProperties: string; portfolioTotals: string };
  pick: { title: string; bodyBefore: string; allProperties: string; bodyAfter: string; note: string };
  keep: { pending: string; label: string };
}

export const shell: Translations<ShellStrings> = {
  en: {
    product: "Central Reservations",
    sections: { overview: "Overview", bookings: "Bookings", inventory: "Inventory & Rates", distribution: "Distribution" },
    nav: {
      "/dashboard": "Dashboard",
      "/reports": "Analytics",
      "/reservations": "Reservations",
      "/waitlist": "Waitlist",
      "/guests": "Guests",
      "/inventory": "Inventory Calendar",
      "/rooms-rates": "Rooms & Rates",
      "/bulk": "Bulk Rates & Availability",
      "/distribution": "Distribution",
      "/booking-engine": "Booking Engine",
      "/activity": "Activity",
      "/help": "Help",
      "/settings": "Settings",
    },
    menu: { account: "Account menu", yourAccount: "Your account", logOut: "Log out", language: "Language", openMenu: "Open menu", closeMenu: "Close menu" },
    roles: {
      owner: "Owner", admin: "Admin", revenue_manager: "Revenue Mgr", distribution_manager: "Distribution", read_only: "Read-only",
      manager: "Manager", reception: "Reception", housekeeper: "Housekeeper", hk_supervisor: "Housekeeping lead",
      maintenance: "Maintenance", outlet_pos: "Outlet / POS",
    },
    search: "Search reservations, guests, rooms, rates…",
    switcher: { yourProperties: "Your properties", allProperties: "All properties", portfolioTotals: "· portfolio totals" },
    pick: {
      title: "This screen belongs to one hotel",
      bodyBefore: "You are viewing",
      allProperties: "All properties",
      bodyAfter: ", which is for comparing performance across the group. This screen changes the settings of a single hotel, so choose which one.",
      note: "Dashboard and Analytics still show the whole portfolio — switch back from the picker at the top whenever you want the group view.",
    },
    keep: { pending: "Letting them know…", label: "I want to keep it" },
  },
  bg: {
    product: "Централни резервации",
    sections: { overview: "Преглед", bookings: "Резервации", inventory: "Наличност и цени", distribution: "Дистрибуция" },
    nav: {
      "/dashboard": "Табло",
      "/reports": "Анализи",
      "/reservations": "Резервации",
      "/waitlist": "Списък на чакащите",
      "/guests": "Гости",
      "/inventory": "Календар на наличността",
      "/rooms-rates": "Стаи и цени",
      "/bulk": "Масови промени",
      "/distribution": "Дистрибуция",
      "/booking-engine": "Директни резервации",
      "/activity": "Активност",
      "/help": "Помощ",
      "/settings": "Настройки",
    },
    menu: { account: "Меню на профила", yourAccount: "Вашият профил", logOut: "Изход", language: "Език", openMenu: "Отваряне на менюто", closeMenu: "Затваряне на менюто" },
    roles: {
      owner: "Собственик", admin: "Администратор", revenue_manager: "Приходи", distribution_manager: "Дистрибуция", read_only: "Само преглед",
      manager: "Управител", reception: "Рецепция", housekeeper: "Хаускийпинг", hk_supervisor: "Старши хаускийпинг",
      maintenance: "Поддръжка", outlet_pos: "Точка на продажба",
    },
    search: "Търсене на резервации, гости, стаи, цени…",
    switcher: { yourProperties: "Вашите обекти", allProperties: "Всички обекти", portfolioTotals: "· общо за групата" },
    pick: {
      title: "Този екран е за един хотел",
      bodyBefore: "Сега гледате",
      allProperties: "Всички обекти",
      bodyAfter: " — изгледът за сравнение между хотелите в групата. Този екран променя настройките на един хотел, затова изберете кой.",
      note: "Таблото и Анализите продължават да показват цялата група — върнете се към нея от менюто горе, когато поискате.",
    },
    keep: { pending: "Уведомяваме ги…", label: "Искам да го запазя" },
  },
};
