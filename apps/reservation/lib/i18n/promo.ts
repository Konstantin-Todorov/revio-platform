import type { Translations } from "@revio/ui/i18n";

export interface PromoStrings {
  nav: string; navBlurb: string;
  title: string; subtitle: string;
  code: string; codeHint: string; percent: string; from: string; to: string; minNights: string; maxUses: string;
  plans: string; allPlans: string; create: string; creating: string;
  empty: string;
  cols: { code: string; discount: string; arrivals: string; nights: string; used: string; status: string };
  anyDate: string; active: string; off: string; turnOn: string; turnOff: string;
  deleteLabel: (code: string) => string; deleteNote: string;
  errors: { code: string; percent: string; dates: string; taken: (code: string) => string };
  saved: (code: string) => string;
}

export const promo: Translations<PromoStrings> = {
  en: {
    nav: "Promo codes", navBlurb: "A percentage off the rooms on your booking page",
    title: "Promo codes",
    subtitle: "Give a code to a newsletter, a returning guest or a partner. On your booking page it takes a percentage off the room price of every night — never off taxes, fees or extras.",
    code: "Code", codeHint: "Letters and digits, e.g. SUMMER10", percent: "% off the rooms", from: "Arrivals from", to: "Arrivals until",
    minNights: "Minimum nights", maxUses: "Maximum uses", plans: "Only on these rates", allPlans: "Leave all unticked for every rate sold direct.",
    create: "Create code", creating: "Creating…",
    empty: "No promo codes yet.",
    cols: { code: "Code", discount: "Discount", arrivals: "Arrivals", nights: "Min nights", used: "Used", status: "Status" },
    anyDate: "any date", active: "Active", off: "Off", turnOn: "Turn on", turnOff: "Turn off",
    deleteLabel: (c) => `Delete code ${c}`, deleteNote: "Bookings already made with it keep their price.",
    errors: { code: "Enter a code of 3–24 letters or digits.", percent: "The discount must be 1–90%.", dates: "“Until” must be on or after “from”.", taken: (c) => `There is already a code ${c}.` },
    saved: (c) => `Code ${c} created.`,
  },
  bg: {
    nav: "Промо кодове", navBlurb: "Процент отстъпка от стаите в страницата за директни резервации",
    title: "Промо кодове",
    subtitle: "Дайте код на абонати, на редовен гост или на партньор. В страницата за директни резервации той намалява с процент цената на стаята за всяка нощувка — никога данъците, таксите или допълнителните услуги.",
    code: "Код", codeHint: "Букви и цифри, напр. SUMMER10", percent: "% отстъпка от стаите", from: "Пристигания от", to: "Пристигания до",
    minNights: "Минимум нощувки", maxUses: "Максимум използвания", plans: "Само за тези тарифи", allPlans: "Оставете всички неотметнати за всички тарифи с директна продажба.",
    create: "Създай код", creating: "Създаваме…",
    empty: "Още няма промо кодове.",
    cols: { code: "Код", discount: "Отстъпка", arrivals: "Пристигания", nights: "Мин. нощувки", used: "Използван", status: "Статус" },
    anyDate: "всяка дата", active: "Активен", off: "Изключен", turnOn: "Включи", turnOff: "Изключи",
    deleteLabel: (c) => `Изтрий кода ${c}`, deleteNote: "Резервациите, направени с него, запазват цената си.",
    errors: { code: "Въведете код от 3 до 24 букви или цифри.", percent: "Отстъпката трябва да е от 1 до 90%.", dates: "„До“ трябва да е на или след „от“.", taken: (c) => `Вече има код ${c}.` },
    saved: (c) => `Кодът ${c} е създаден.`,
  },
};
