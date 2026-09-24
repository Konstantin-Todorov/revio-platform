import type { Translations } from "@revio/ui/i18n";

/** The Front Desk — the screen a receptionist lives on. Shared words live in `common.ts`. */
export interface FrontDeskStrings {
  title: string;
  subtitle: (property: string, date: string) => string;
  walkIn: string;
  setupPromise: string;
  /** The checklist's steps, by the key `reviopmsSetup` in core gives them. */
  setupSteps: Record<string, { title: string; body: string; cta: string }>;
  strip: {
    overstayed: (n: number) => string;
    pastTime: (n: number) => string;
    blocked: (n: number) => string;
    balance: (n: number) => string;
    conflict: (n: number) => string;
    returning: (n: number) => string;
  };
  kpi: { arrivals: string; departures: string; inHouse: string; roomsReady: string; outOfOrder: string };
  toCheckIn: string;
  blocked: (n: number) => string;
  noArrivals: string;
  dueOutToday: string;
  overdueCount: (n: number) => string;
  noDepartures: string;
  overstayed: (nights: number) => string;
  pastCheckout: (h: number, m: number) => string;
  conflictLead: string;
  conflictBody: string;
  roster: string;
  inHouseCount: (n: number) => string;
  nobodyInHouse: string;
  allDueOut: string;
  departedToday: string;
  footnote: (checkOutTime: string) => string;
}

export const frontdesk: Translations<FrontDeskStrings> = {
  en: {
    title: "Front Desk",
    subtitle: (property, date) => `${property} · ${date} (property time)`,
    walkIn: "Walk-in",
    setupPromise: "Four steps and your front desk can check a guest into a real room.",
    setupSteps: {
      property: { title: "Your property is set up", body: "Created with your account, along with a starting rate plan.", cta: "Review" },
      "room-types": { title: "Add your room types", body: "Defined once for the whole platform, in RevioLink or RevioCRS under Rooms & Rates.", cta: "See rooms" },
      units: { title: "Add your physical rooms", body: "Room 101, 102, 201 — the actual doors housekeeping cleans and guests sleep behind.", cta: "Add rooms" },
      configuration: { title: "Check your property setup", body: "Check-out time, VAT and city tax, and whether cleaned rooms need inspecting.", cta: "Open configuration" },
      staff: { title: "Add your team", body: "Reception, housekeeping and maintenance each see only the screens they need.", cta: "Add staff" },
    },
    strip: {
      overstayed: (n) => `${n} overstayed — past departure, still in-house (distorts occupancy)`,
      pastTime: (n) => `${n} past checkout time`,
      blocked: (n) => `${n} arrival${n === 1 ? "" : "s"} with no ready room`,
      balance: (n) => `${n} due-out${n === 1 ? "" : "s"} with a balance`,
      conflict: (n) => `${n} room assignment conflict${n === 1 ? "" : "s"}`,
      returning: (n) => `${n} returning guest${n === 1 ? "" : "s"} arriving`,
    },
    kpi: { arrivals: "Arrivals today", departures: "Departures today", inHouse: "In-house", roomsReady: "Rooms ready to assign", outOfOrder: "Out of order" },
    toCheckIn: "To check in",
    blocked: (n) => `${n} blocked`,
    noArrivals: "No one left to check in today.",
    dueOutToday: "Due out today",
    overdueCount: (n) => `${n} overdue`,
    noDepartures: "No departures due out today.",
    overstayed: (n) => `Overstayed ${n} night${n === 1 ? "" : "s"}`,
    pastCheckout: (h, m) => `Past checkout by ${h > 0 ? `${h}h ` : ""}${m}m`,
    conflictLead: "Room assignment conflict.",
    conflictBody: "The same physical room holds more than one in-house guest — resolve with a room move:",
    roster: "In-house roster",
    inHouseCount: (n) => `${n} in house`,
    nobodyInHouse: "No one in house tonight.",
    allDueOut: "Everyone in house is due out today — see the column above.",
    departedToday: "Departed today",
    footnote: (t) => `Exceptions surface at the top; routine stays quiet. Arrivals come from the shared reservation record (RevioCRS / channels). Rooms-ready reflects the live pool of clean/inspected rooms — is housekeeping the blocker? Overdue is measured against the property checkout time (${t}, set in Configuration).`,
  },
  bg: {
    title: "Рецепция",
    subtitle: (property, date) => `${property} · ${date} (часът на обекта)`,
    walkIn: "Гост без резервация",
    setupPromise: "Четири стъпки и рецепцията може да настани гост в истинска стая.",
    setupSteps: {
      property: { title: "Обектът Ви е създаден", body: "Създаден е заедно с профила Ви, с начален ценови план.", cta: "Преглед" },
      "room-types": { title: "Добавете типовете стаи", body: "Задават се веднъж за цялата платформа — в RevioLink или RevioCRS, в „Стаи и цени“.", cta: "Към стаите" },
      units: { title: "Добавете физическите стаи", body: "Стая 101, 102, 201 — истинските врати, които хаускийпингът почиства и зад които спят гостите.", cta: "Добави стаи" },
      configuration: { title: "Проверете настройките на обекта", body: "Час за напускане, ДДС и туристически данък и дали почистените стаи се проверяват.", cta: "Към конфигурацията" },
      staff: { title: "Добавете екипа си", body: "Рецепцията, хаускийпингът и поддръжката виждат само екраните, които им трябват.", cta: "Добави служители" },
    },
    strip: {
      overstayed: (n) => `${n} ${n === 1 ? "гост е останал" : "гости са останали"} след датата на напускане — изкривява заетостта`,
      pastTime: (n) => `${n} ${n === 1 ? "гост е" : "гости са"} след часа за напускане`,
      blocked: (n) => `${n} ${n === 1 ? "пристигащ гост е" : "пристигащи гости са"} без готова стая`,
      balance: (n) => `${n} ${n === 1 ? "напускащ гост дължи" : "напускащи гости дължат"} пари`,
      conflict: (n) => `${n} ${n === 1 ? "конфликт" : "конфликта"} за стаи`,
      returning: (n) => `${n} ${n === 1 ? "завръщащ се гост пристига" : "завръщащи се гости пристигат"}`,
    },
    kpi: { arrivals: "Пристигания днес", departures: "Напускания днес", inHouse: "В хотела", roomsReady: "Готови стаи", outOfOrder: "Извън експлоатация" },
    toCheckIn: "За настаняване",
    blocked: (n) => `${n} без стая`,
    noArrivals: "Няма повече гости за настаняване днес.",
    dueOutToday: "Напускат днес",
    overdueCount: (n) => `${n} закъсняват`,
    noDepartures: "Днес никой не напуска.",
    overstayed: (n) => `Остава ${n} ${n === 1 ? "нощувка" : "нощувки"} след напускането`,
    pastCheckout: (h, m) => `${h > 0 ? `${h} ч. ` : ""}${m} мин. след часа за напускане`,
    conflictLead: "Конфликт за стая.",
    conflictBody: "В една и съща стая са настанени повече от един гост — преместете единия:",
    roster: "Гости в хотела",
    inHouseCount: (n) => `${n} в хотела`,
    nobodyInHouse: "Тази нощ няма гости в хотела.",
    allDueOut: "Всички гости в хотела напускат днес — вижте колоната горе.",
    departedToday: "Напуснали днес",
    footnote: (t) => `Изключенията са най-горе, рутинните неща не шумят. Пристиганията идват от общия запис на резервациите (RevioCRS и каналите). „Готови стаи“ показва чистите и проверени стаи в момента — проверете дали хаускийпингът не забавя. Закъснението се мери спрямо часа за напускане на обекта (${t}, в Конфигурация).`,
  },
};
