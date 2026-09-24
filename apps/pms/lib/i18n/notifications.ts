import type { Translations } from "@revio/ui/i18n";

/** What RevioPMS's bell says — the attention states and the events. Built on the server. */
export interface NotificationStrings {
  closeDue: (date: string) => string;
  behind: (days: number) => string;
  arrivals: (n: number) => string;
  toClean: (n: number) => string;
  outOfOrder: (n: number) => string;
  balances: (n: number) => string;
  room: (label: string) => string;
  noRoom: string;
  oooBody: string;
  priority: Record<string, string>;
  backInService: (room: string) => string;
  guest: string;
  checkedOut: (guest: string) => string;
  newBooking: (guest: string) => string;
  noName: string;
}

export const notifications: Translations<NotificationStrings> = {
  en: {
    closeDue: (d) => `Close Day is due — ${d}`,
    behind: (n) => `Business date ${n} day${n === 1 ? "" : "s"} behind`,
    arrivals: (n) => `${n} arrival${n === 1 ? "" : "s"} to check in`,
    toClean: (n) => `${n} room${n === 1 ? "" : "s"} to clean`,
    outOfOrder: (n) => `${n} room${n === 1 ? "" : "s"} out of order`,
    balances: (n) => `${n} open balance${n === 1 ? "" : "s"}`,
    room: (l) => `Room ${l}`,
    noRoom: "No room",
    oooBody: "out of order — not sellable",
    priority: { low: "low priority", normal: "normal priority", high: "high priority" },
    backInService: (r) => `${r} back in service`,
    guest: "Guest",
    checkedOut: (g) => `${g} checked out`,
    newBooking: (g) => `New booking — ${g}`,
    noName: "no name given",
  },
  bg: {
    closeDue: (d) => `Време е за затваряне на деня — ${d}`,
    behind: (n) => `Работната дата изостава с ${n} ${n === 1 ? "ден" : "дни"}`,
    arrivals: (n) => `${n} ${n === 1 ? "пристигане" : "пристигания"} за настаняване`,
    toClean: (n) => `${n} ${n === 1 ? "стая" : "стаи"} за почистване`,
    outOfOrder: (n) => `${n} ${n === 1 ? "стая" : "стаи"} извън експлоатация`,
    balances: (n) => `${n} ${n === 1 ? "неплатена сметка" : "неплатени сметки"}`,
    room: (l) => `Стая ${l}`,
    noRoom: "Без стая",
    oooBody: "извън експлоатация — не се продава",
    priority: { low: "ниска спешност", normal: "нормална спешност", high: "висока спешност" },
    backInService: (r) => `${r} отново в експлоатация`,
    guest: "Гост",
    checkedOut: (g) => `${g} напусна`,
    newBooking: (g) => `Нова резервация — ${g}`,
    noName: "без име",
  },
};
