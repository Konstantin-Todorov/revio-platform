import type { Translations } from "@revio/ui/i18n";
import type { HkStatus } from "../hk-meta";

/**
 * Words every RevioPMS screen shares — one definition, so "Check in" is never translated two ways.
 *
 * Hotel Bulgarian, as a receptionist says it: нощувка for a night, настаняване / напускане for check-in
 * / check-out, сметка for a folio. Glossary rules in `@revio/ui/i18n`. Formal Вие.
 */
export interface CommonStrings {
  nights: (n: number) => string;
  rooms: (n: number) => string;
  statuses: Record<HkStatus, string>;
  ready: { ready: string; partial: string; none: string };
  checkIn: string;
  checkingIn: string;
  checkOut: string;
  checkingOut: string;
  folio: string;
  folioTitle: string;
  moveRoom: string;
  open: string;
  overdue: string;
  returning: string;
  returningGuest: string;
  roomConflict: string;
  balance: (amount: string) => string;
  room: (label: string) => string;
  cancel: string;
  save: string;
  saving: string;
  back: string;
  guest: string;
}

export const common: Translations<CommonStrings> = {
  en: {
    nights: (n) => `${n} night${n === 1 ? "" : "s"}`,
    rooms: (n) => `${n} room${n === 1 ? "" : "s"}`,
    statuses: { clean: "Clean", dirty: "Dirty", in_progress: "Cleaning", inspected: "Inspected", out_of_order: "Out of order" },
    ready: { ready: "Room ready", partial: "Partly ready", none: "Awaiting housekeeping" },
    checkIn: "Check in",
    checkingIn: "Checking in…",
    checkOut: "Check out",
    checkingOut: "Checking out…",
    folio: "Folio",
    folioTitle: "Folio / bill",
    moveRoom: "Move room",
    open: "Open",
    overdue: "Overdue",
    returning: "Returning",
    returningGuest: "Returning guest",
    roomConflict: "Room conflict",
    balance: (amount) => `Balance ${amount}`,
    room: (label) => `Room ${label}`,
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    back: "Back",
    guest: "Guest",
  },
  bg: {
    nights: (n) => `${n} ${n === 1 ? "нощувка" : "нощувки"}`,
    rooms: (n) => `${n} ${n === 1 ? "стая" : "стаи"}`,
    statuses: { clean: "Чиста", dirty: "Мръсна", in_progress: "Почиства се", inspected: "Проверена", out_of_order: "Извън експлоатация" },
    ready: { ready: "Стаята е готова", partial: "Частично готова", none: "Чака хаускийпинг" },
    checkIn: "Настаняване",
    checkingIn: "Настаняване…",
    checkOut: "Напускане",
    checkingOut: "Напускане…",
    folio: "Сметка",
    folioTitle: "Сметка",
    moveRoom: "Преместване в друга стая",
    open: "Отвори",
    overdue: "Закъснява",
    returning: "Завръщащ се",
    returningGuest: "Завръщащ се гост",
    roomConflict: "Конфликт за стая",
    balance: (amount) => `Дължи ${amount}`,
    room: (label) => `Стая ${label}`,
    cancel: "Отказ",
    save: "Запази",
    saving: "Запазване…",
    back: "Назад",
    guest: "Гост",
  },
};
