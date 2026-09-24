import type { Translations } from "@revio/ui/i18n";

type Section = { label: string; blurb: string };

/**
 * RevioPMS → Settings: the frame, the section list and the sections this product owns.
 *
 * Billing, two-factor and "sign out everywhere" are shared components rendered identically in all
 * three products, so they are translated once, in `@revio/ui`, not here.
 */
export interface SettingsStrings {
  title: string;
  nav: { aria: string; elsewhere: string };
  sections: Record<"property" | "operations" | "connections" | "billing" | "account", Section>;
  elsewhere: Record<"rooms" | "catalog" | "closeday" | "help", Section>;
  property: {
    title: string;
    name: string;
    timezone: string;
    currency: string;
    checkInOut: string;
    businessDate: string;
    sharedNote: string;
    staffTitle: string;
    staffBefore: string;
    staffWhere: string;
    staffAfter: string;
  };
  operations: {
    rooms: string;
    roomsSub: (units: number, types: number) => string;
    catalog: string;
    catalogSub: (items: number) => string;
    closeday: string;
    closedaySub: string;
  };
  connections: {
    title: string;
    managed: string;
    none: string;
    modes: Record<string, string>;
    statuses: Record<string, string>;
    note: string;
  };
  account: { twoFactor: string; twoFactorSub: string; signIn: string; signInSub: string };
}

export const settings: Translations<SettingsStrings> = {
  en: {
    title: "Settings",
    nav: { aria: "Settings sections", elsewhere: "Elsewhere" },
    sections: {
      property: { label: "Property", blurb: "Your hotel's profile and who may use it — both shared across the platform" },
      operations: { label: "Operations", blurb: "Rooms, the minibar catalogue and the night audit" },
      connections: { label: "Connections", blurb: "The channels this property sells on" },
      billing: { label: "Billing", blurb: "What you pay, and every invoice we have issued" },
      account: { label: "Your account", blurb: "Two-factor authentication and your sessions" },
    },
    elsewhere: {
      rooms: { label: "Rooms & units", blurb: "The physical rooms and their types" },
      catalog: { label: "Minibar / POS", blurb: "What can be posted to a folio" },
      closeday: { label: "Close Day", blurb: "Roll the business date" },
      help: { label: "Help & support", blurb: "Answers, and every request you have sent us" },
    },
    property: {
      title: "Property",
      name: "Name:",
      timezone: "Time zone:",
      currency: "Currency:",
      checkInOut: "Check-in / out:",
      businessDate: "Business date:",
      sharedNote: "Property profile, rooms and rates are shared across the platform — edit them in RevioLink / RevioCRS.",
      staffTitle: "Staff & permissions",
      staffBefore: "Staff accounts and roles are managed once in",
      staffWhere: "RevioLink → Settings",
      staffAfter: "— one account works across every product this hotel has.",
    },
    operations: {
      rooms: "Rooms & Units",
      roomsSub: (u, t) => `${u} rooms · ${t} types`,
      catalog: "Minibar / POS catalog",
      catalogSub: (n) => `${n} items`,
      closeday: "Close Day (night audit)",
      closedaySub: "roll the business date",
    },
    connections: {
      title: "Connections",
      managed: "managed in RevioLink",
      none: "No channels on this property. Distribution is configured in RevioLink.",
      modes: { mock: "Test connection", channex_sandbox: "Channex — test", channex_prod: "Channex" },
      statuses: { connected: "connected", not_connected: "not connected", pending: "pending", error: "error", disabled: "disabled" },
      note: "A room going out-of-order here comes off sale on these channels automatically (shared availability core).",
    },
    account: {
      twoFactor: "Two-factor authentication",
      twoFactorSub: "Protects this account in every Revio product you use",
      signIn: "Your sign-in",
      signInSub: "Sessions on this and any other device",
    },
  },
  bg: {
    title: "Настройки",
    nav: { aria: "Раздели на настройките", elsewhere: "Другаде" },
    sections: {
      property: { label: "Обект", blurb: "Профилът на хотела и кой има достъп — общи за цялата платформа" },
      operations: { label: "Операции", blurb: "Стаите, каталогът на минибара и затварянето на деня" },
      connections: { label: "Връзки", blurb: "Каналите, по които продава обектът" },
      billing: { label: "Плащания към Revio", blurb: "Какво плащате и всички фактури, които сме издали" },
      account: { label: "Вашият профил", blurb: "Двуфакторна защита и Вашите сесии" },
    },
    elsewhere: {
      rooms: { label: "Стаи", blurb: "Физическите стаи и техните типове" },
      catalog: { label: "Екстри и такси", blurb: "Какво може да се начислява в сметка" },
      closeday: { label: "Затваряне на деня", blurb: "Смяна на работната дата" },
      help: { label: "Помощ и поддръжка", blurb: "Отговори и всички запитвания, които сте ни изпратили" },
    },
    property: {
      title: "Обект",
      name: "Име:",
      timezone: "Часова зона:",
      currency: "Валута:",
      checkInOut: "Настаняване / напускане:",
      businessDate: "Работна дата:",
      sharedNote: "Профилът на обекта, стаите и цените са общи за платформата — редактират се в RevioLink или RevioCRS.",
      staffTitle: "Персонал и права",
      staffBefore: "Профилите и ролите на персонала се управляват на едно място —",
      staffWhere: "RevioLink → Настройки",
      staffAfter: "— един профил работи във всички продукти на хотела.",
    },
    operations: {
      rooms: "Стаи",
      roomsSub: (u, t) => `${u} ${u === 1 ? "стая" : "стаи"} · ${t} ${t === 1 ? "тип" : "типа"}`,
      catalog: "Каталог на екстрите",
      catalogSub: (n) => `${n} ${n === 1 ? "артикул" : "артикула"}`,
      closeday: "Затваряне на деня",
      closedaySub: "смяна на работната дата",
    },
    connections: {
      title: "Връзки",
      managed: "управляват се в RevioLink",
      none: "Обектът няма канали. Дистрибуцията се настройва в RevioLink.",
      modes: { mock: "Тестова връзка", channex_sandbox: "Channex — тест", channex_prod: "Channex" },
      statuses: { connected: "свързан", not_connected: "не е свързан", pending: "в изчакване", error: "грешка", disabled: "изключен" },
      note: "Стая, извадена от експлоатация тук, автоматично спира да се продава по тези канали (общата наличност).",
    },
    account: {
      twoFactor: "Двуфакторна защита",
      twoFactorSub: "Защитава профила Ви във всеки продукт на Revio, който ползвате",
      signIn: "Вашият вход",
      signInSub: "Сесии на това и на всяко друго устройство",
    },
  },
};
