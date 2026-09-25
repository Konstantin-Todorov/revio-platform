import type { Translations } from "@revio/ui/i18n";

/**
 * Words every RevioCRS screen shares — one definition, so a status or a range is never translated
 * two ways on two screens.
 *
 * Hotel Bulgarian as revenue and reservations staff say it: нощувка for a room-night, заетост for
 * occupancy, анулация for a cancellation; ADR and RevPAR stay as the industry writes them. Glossary
 * rules in `@revio/ui/i18n`. Formal Вие.
 */
export interface CommonStrings {
  /** Reservation statuses, by the stored code. */
  statuses: Record<string, string>;
  /** The date presets, by `RangePreset`. A custom range is written from its two dates. */
  ranges: Record<"today" | "tomorrow" | "l7d" | "l28d" | "mtd" | "ytd" | "n7d" | "n28d", string>;
  /** Short names of the presets, for the buttons. */
  presetButtons: Record<"today" | "tomorrow" | "l7d" | "l28d" | "ytd" | "n7d" | "n28d", string>;
  nextDays: (n: number) => string;
  /** The comparison basis, as a delta suffix: "+4% YoY". */
  basis: { yoy: string; lw: string; stly: string };
  /** Percentage points — the unit of a change in a rate. */
  pp: string;
  nights: (n: number) => string;
  roomNights: (n: number) => string;
  rooms: (n: number) => string;
  guests: (n: number) => string;
  save: string;
  saving: string;
  saveChanges: string;
  saved: string;
  cancel: string;
  delete: string;
  edit: string;
  add: string;
  apply: string;
  back: string;
  open: string;
  all: string;
  none: string;
  active: string;
  inactive: string;
  yes: string;
  no: string;
  direct: string;
  roomOnly: string;
  /** The confirm-then-delete dialog every CRS list uses. */
  deleteDialog: { aria: (label: string) => string; title: (label: string) => string; removes: string };
  /** Why an action refused — `lib/authz.ts`. `what` is keyed by `Capability`; core's English is held to it by a drift test. */
  authz: {
    expired: string;
    switchedOff: string;
    readOnly: (what: string) => string;
    cannot: (what: string) => string;
    what: Record<"manageStaff" | "manageSettings" | "manageRates" | "manageInventory" | "manageDistribution" | "manageReservations" | "manageSubscription", string>;
  };
}

export const common: Translations<CommonStrings> = {
  en: {
    statuses: {
      confirmed: "confirmed", modified: "modified", cancelled: "cancelled", no_show: "no-show",
      overbooked: "overbooked", failed_import: "failed import", expired: "expired", hold: "hold",
      requested: "requested", new: "new", draft: "draft",
    },
    ranges: {
      today: "Today", tomorrow: "Tomorrow", l7d: "Last 7 days", l28d: "Last 28 days", mtd: "Month to date",
      ytd: "Year to date", n7d: "Next 7 days", n28d: "Next 28 days",
    },
    presetButtons: { today: "Today", tomorrow: "Tomorrow", l7d: "L7D", l28d: "L28D", ytd: "YTD", n7d: "N7D", n28d: "N28D" },
    nextDays: (n) => `Next ${n} days`,
    basis: { yoy: "YoY", lw: "LW", stly: "STLY" },
    pp: "pp",
    nights: (n) => `${n} night${n === 1 ? "" : "s"}`,
    roomNights: (n) => `${n} room-night${n === 1 ? "" : "s"}`,
    rooms: (n) => `${n} room${n === 1 ? "" : "s"}`,
    guests: (n) => `${n} guest${n === 1 ? "" : "s"}`,
    save: "Save",
    saving: "Saving…",
    saveChanges: "Save changes",
    saved: "Saved",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    apply: "Apply",
    back: "Back",
    open: "Open",
    all: "All",
    none: "None",
    active: "active",
    inactive: "inactive",
    yes: "Yes",
    no: "No",
    direct: "Direct",
    roomOnly: "room only",
    deleteDialog: { aria: (l) => `Delete ${l}`, title: (l) => `Delete ${l}?`, removes: "This removes" },
    authz: {
      expired: "Your session has expired. Sign in again.",
      switchedOff: "RevioCRS is switched off for this hotel, so this change was not saved. Nothing has been deleted — reload to see where it stands.",
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
    statuses: {
      confirmed: "потвърдена", modified: "променена", cancelled: "анулирана", no_show: "неявил се",
      overbooked: "свръхрезервирана", failed_import: "неуспешен внос", expired: "изтекла", hold: "задържана",
      requested: "заявка", new: "нова", draft: "чернова",
    },
    ranges: {
      today: "Днес", tomorrow: "Утре", l7d: "Последните 7 дни", l28d: "Последните 28 дни", mtd: "От началото на месеца",
      ytd: "От началото на годината", n7d: "Следващите 7 дни", n28d: "Следващите 28 дни",
    },
    presetButtons: { today: "Днес", tomorrow: "Утре", l7d: "−7 дни", l28d: "−28 дни", ytd: "Год. досега", n7d: "+7 дни", n28d: "+28 дни" },
    nextDays: (n) => `Следващите ${n} дни`,
    basis: { yoy: "г/г", lw: "с/с", stly: "мин. год." },
    pp: " п.п.",
    nights: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
    roomNights: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
    rooms: (n) => `${n} ${n === 1 ? "стая" : "стаи"}`,
    guests: (n) => `${n} ${n === 1 ? "гост" : "гости"}`,
    save: "Запази",
    saving: "Запазване…",
    saveChanges: "Запази промените",
    saved: "Запазено",
    cancel: "Отказ",
    delete: "Изтрий",
    edit: "Редактирай",
    add: "Добави",
    apply: "Приложи",
    back: "Назад",
    open: "Отвори",
    all: "Всички",
    none: "Няма",
    active: "активен",
    inactive: "неактивен",
    yes: "Да",
    no: "Не",
    direct: "Директно",
    roomOnly: "само нощувка",
    deleteDialog: { aria: (l) => `Изтрий ${l}`, title: (l) => `Изтриване на ${l}?`, removes: "Това премахва" },
    authz: {
      expired: "Сесията Ви е изтекла. Влезте отново.",
      switchedOff: "RevioCRS е изключен за този хотел, затова промяната не е запазена. Нищо не е изтрито — презаредете, за да видите състоянието.",
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
