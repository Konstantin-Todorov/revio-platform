import type { Translations } from "@revio/ui/i18n";
import type { HkStatus } from "../hk-meta";

/**
 * The housekeeping board — the screen a housekeeper reads on a phone, and the first one translated
 * whole. Status and reason VALUES stay English in the data (they are keys); only what is shown here
 * is translated. Glossary: хаускийпинг (never "камериерски отдел"). Formal Вие. terminology:allow
 */
export interface HousekeepingStrings {
  title: string;
  subtitle: (property: string, rooms: number) => string;
  smartOrder: string;
  byFloor: string;
  clockedInSince: (time: string) => string;
  notClockedIn: string;
  active: (n: number) => string;
  clockIn: string;
  clockOut: string;
  blockedLead: string;
  blockedBody: (room: string) => string;
  emptyTitle: string;
  emptyBefore: string;
  emptyLink: string;
  emptyAfter: string;
  occupied: string;
  vacant: string;
  dueOut: string;
  queueHeading: (n: number) => string;
  queueEmpty: string;
  restHeading: (n: number) => string;
  unassignedFloor: string;
  footnoteLead: string;
  footnoteOoo: string;
  footnoteTail: string;
  statuses: Record<HkStatus, string>;
  reasons: Record<string, string>;
  actions: { statusAria: string; start: string; starting: string; finish: string; report: string; describe: string; log: string };
}

export const housekeeping: Translations<HousekeepingStrings> = {
  en: {
    title: "Housekeeping",
    subtitle: (property, rooms) => `${property} · ${rooms} room${rooms === 1 ? "" : "s"} · one room in progress at a time`,
    smartOrder: "Smart order",
    byFloor: "By floor",
    clockedInSince: (time) => `You’re clocked in since ${time}`,
    notClockedIn: "You’re not clocked in — clock in to receive room assignments.",
    active: (n) => `${n} active`,
    clockIn: "Clock in",
    clockOut: "Clock out",
    blockedLead: "One room at a time.",
    blockedBody: (room) => `Finish or release room ${room} before starting another — the only exception is connecting rooms.`,
    emptyTitle: "No rooms to clean yet",
    emptyBefore: "Add your physical rooms in",
    emptyLink: "Rooms",
    emptyAfter: "and they’ll appear here for the housekeeping team.",
    occupied: "Occupied",
    vacant: "Vacant",
    dueOut: "DUE OUT",
    queueHeading: (n) => `Cleaning queue (${n}) — recommended order`,
    queueEmpty: "Nothing waiting to be cleaned — all rooms are clean, inspected or occupied.",
    restHeading: (n) => `Not in the queue (${n})`,
    unassignedFloor: "Unassigned",
    footnoteLead: "Smart order cleans by priority — turn-for-arrival first, no-pressure last — with the reason on each room so staff trust it. The one-room-in-progress rule blocks starting a second, non-connecting room. Marking a room",
    footnoteOoo: "Out of order",
    footnoteTail: "takes it off sale on every channel via the shared waterfall.",
    statuses: { clean: "Clean", dirty: "Dirty", in_progress: "Cleaning", inspected: "Inspected", out_of_order: "Out of order" },
    reasons: {
      "Turn for arrival": "Turn for arrival",
      "Arrival today": "Arrival today",
      Departure: "Departure",
      Stayover: "Stayover",
      "No arrival pressure": "No arrival pressure",
    },
    actions: { statusAria: "Housekeeping status", start: "Start", starting: "Starting…", finish: "Finish", report: "Report an issue", describe: "Describe the fault…", log: "Log" },
  },
  bg: {
    title: "Хаускийпинг",
    subtitle: (property, rooms) => `${property} · ${rooms} ${rooms === 1 ? "стая" : "стаи"} · по една стая в процес наведнъж`,
    smartOrder: "По приоритет",
    byFloor: "По етажи",
    clockedInSince: (time) => `На смяна сте от ${time}`,
    notClockedIn: "Не сте на смяна — започнете смяна, за да Ви се разпределят стаи.",
    active: (n) => `${n} на смяна`,
    clockIn: "Начало на смяна",
    clockOut: "Край на смяна",
    blockedLead: "По една стая наведнъж.",
    blockedBody: (room) => `Завършете или освободете стая ${room}, преди да започнете друга — изключение са само свързаните стаи.`,
    emptyTitle: "Все още няма стаи за почистване",
    emptyBefore: "Добавете физическите стаи в",
    emptyLink: "Стаи",
    emptyAfter: "и те ще се появят тук за екипа по хаускийпинг.",
    occupied: "Заета",
    vacant: "Свободна",
    dueOut: "НАПУСКА ДНЕС",
    queueHeading: (n) => `За почистване (${n}) — препоръчителен ред`,
    queueEmpty: "Няма стаи за почистване — всички са чисти, проверени или заети.",
    restHeading: (n) => `Извън опашката (${n})`,
    unassignedFloor: "Без етаж",
    footnoteLead: "Подредбата по приоритет почиства първо стаите за пристигащи гости и последно тези без спешност, като причината е изписана на всяка стая. Правилото „по една стая наведнъж“ не позволява да започнете втора стая, освен ако е свързана. Стая, маркирана като",
    footnoteOoo: "Извън експлоатация",
    footnoteTail: "се спира от продажба във всички канали.",
    statuses: { clean: "Чиста", dirty: "Мръсна", in_progress: "Почиства се", inspected: "Проверена", out_of_order: "Извън експлоатация" },
    reasons: {
      "Turn for arrival": "За пристигащ гост",
      "Arrival today": "Пристигане днес",
      Departure: "Напускане",
      Stayover: "Остава",
      "No arrival pressure": "Без спешност",
    },
    actions: { statusAria: "Статус на стаята", start: "Започни", starting: "Започва…", finish: "Готово", report: "Съобщете за проблем", describe: "Опишете повредата…", log: "Запиши" },
  },
};
