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
  direct: {
    title: string; subtitle: string; label: string; save: string; saving: string;
    appliesTo: string; notOn: string; none: string; off: string; caution: string;
    saved: (pct: number) => string; error: string;
  };
}

export const promo: Translations<PromoStrings> = {
  en: {
    nav: "Discounts", navBlurb: "Cheaper direct than on booking sites, and promo codes",
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
    direct: {
      title: "Cheaper when booked direct",
      subtitle: "A percentage off every rate you also sell on a booking site. Guests on your booking page see the booking-site price struck through and how much they save — true by construction, because it is the price we send those sites. A booking without commission is worth more to you even after the discount.",
      label: "% off for booking direct", save: "Save", saving: "Saving…",
      appliesTo: "Applies to these rates (on sale on a connected booking site):",
      notOn: "Not applied to — sold only here, so there is no booking-site price to compare with:",
      none: "None of your direct rates is on a connected booking site yet, so there is nothing to compare with.",
      off: "0 switches it off.",
      caution: "If you also give Booking.com Genius or other member discounts, keep this at least as large, or a member will find it cheaper there.",
      saved: (p) => (p > 0 ? `Direct bookings now ${p}% cheaper than on booking sites.` : "Direct discount switched off."),
      error: "Enter a whole number from 0 to 30.",
    },
  },
  bg: {
    nav: "Отстъпки", navBlurb: "По-евтино директно, отколкото в сайтовете за резервации, и промо кодове",
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
    direct: {
      title: "По-евтино при директна резервация",
      subtitle: "Процент отстъпка от всяка тарифа, която продавате и в сайт за резервации. Гостите в страницата за директни резервации виждат зачеркната цената от сайта и колко спестяват — вярно по конструкция, защото това е цената, която изпращаме на тези сайтове. Резервация без комисионна Ви носи повече дори след отстъпката.",
      label: "% отстъпка за директна резервация", save: "Запази", saving: "Запазваме…",
      appliesTo: "Важи за тези тарифи (продават се в свързан сайт за резервации):",
      notOn: "Не важи за — продават се само тук, така че няма цена от сайт, с която да се сравни:",
      none: "Никоя от директните Ви тарифи още не се продава в свързан сайт за резервации, така че няма с какво да се сравни.",
      off: "0 я изключва.",
      caution: "Ако давате и Genius или други отстъпки за членове в Booking.com, дръжте тази поне толкова голяма, иначе членовете ще намерят по-ниска цена там.",
      saved: (p) => (p > 0 ? `Директните резервации вече са с ${p}% по-евтини от сайтовете за резервации.` : "Отстъпката за директна резервация е изключена."),
      error: "Въведете цяло число от 0 до 30.",
    },
  },
};
