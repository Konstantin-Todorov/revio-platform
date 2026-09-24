import type { Translations } from "@revio/ui/i18n";

/** The reservation view — the action hub for one stay. */
export interface ReservationStrings {
  subtitle: (roomTypes: string, from: string, to: string, nights: string) => string;
  states: { booked: string; assigned: string; in_house: string; departed: string; cancelled: string };
  dueOutToday: string;
  sharedRecord: string;
  registerKept: string;
  occupancyError: string;
  commercial: string;
  commercialSub: string;
  source: string;
  ratePlan: string;
  mealPlan: string;
  roomOnly: string;
  cancellation: string;
  paymentTerms: string;
  payLabels: Record<string, string>;
  roomsGuests: string;
  total: string;
  note: (n: string) => string;
  operational: string;
  operationalSub: string;
  assignedRoom: string;
  notAssigned: string;
  stayState: string;
  guestsInRoom: string;
  ofMax: (n: number) => string;
  update: string;
  occupancyNote: string;
  folioBalance: string;
  noFolio: string;
  deposits: string;
  held: (amount: string) => string;
  noDeposit: string;
  openFolio: string;
  postCharge: string;
  reopenPlaceholder: string;
  reopenTitle: string;
  managerOnly: string;
  reopen: string;
  timeline: string;
  timelineSub: string;
  events: {
    booking: string;
    assigned: (room: string) => string;
    moved: (room: string) => string;
    checkin: (room: string) => string;
    checkout: (room: string) => string;
    charge: string;
    payment: string;
    cancel: string;
  };
}

export const reservation: Translations<ReservationStrings> = {
  en: {
    subtitle: (types, from, to, nights) => `${types} · ${from} → ${to} · ${nights}`,
    states: { booked: "Booked — not arrived", assigned: "Room assigned", in_house: "In house", departed: "Departed", cancelled: "Cancelled" },
    dueOutToday: "Due out today",
    sharedRecord: "One shared record, two phases — the commercial fields below were written by RevioCRS / the channel at booking; the PMS extends the same record operationally. It is never a synced copy.",
    registerKept: "That register entry has details in it and can’t be removed — the register has to be kept for two years. Correct it instead.",
    occupancyError: "That guest count doesn’t fit the room. A room that sleeps two can’t be sold to three — move the stay to a larger room type first.",
    commercial: "Commercial",
    commercialSub: "From RevioCRS / channel · read-only",
    source: "Source",
    ratePlan: "Rate plan",
    mealPlan: "Meal plan",
    roomOnly: "Room only",
    cancellation: "Cancellation",
    paymentTerms: "Payment terms",
    payLabels: { card_on_file: "Card on file", company_account: "Company account", prepaid_ota: "Prepaid (OTA)", none: "None" },
    roomsGuests: "Rooms · guests",
    total: "Reservation total",
    note: (n) => `Note: ${n}`,
    operational: "Operational",
    operationalSub: "Set here, at this property",
    assignedRoom: "Assigned room",
    notAssigned: "Not assigned yet — assigned at check-in",
    stayState: "Stay state",
    guestsInRoom: "Guests in the room",
    ofMax: (n) => `of ${n} max`,
    update: "Update",
    occupancyNote: "Changing this reprices the remaining nights on a per-person rate. Nights already stayed keep what they were sold at.",
    folioBalance: "Folio balance",
    noFolio: "No folio yet",
    deposits: "Deposits",
    held: (a) => `${a} held`,
    noDeposit: "No deposit held",
    openFolio: "Open folio",
    postCharge: "Post charge",
    reopenPlaceholder: "Why reopen this stay?",
    reopenTitle: "Reopen this stay — the rooms are not held, so it will need checking in again",
    managerOnly: "Manager approval required",
    reopen: "Reopen stay",
    timeline: "Timeline",
    timelineSub: "Booking received → assigned → checked in → moved → charges → checked out",
    events: {
      booking: "Booking received",
      assigned: (r) => `Room ${r} assigned`,
      moved: (r) => `Moved to room ${r}`,
      checkin: (r) => `Checked in — room ${r}`,
      checkout: (r) => `Checked out — room ${r}`,
      charge: "Charge posted",
      payment: "Payment recorded",
      cancel: "Cancelled",
    },
  },
  bg: {
    subtitle: (types, from, to, nights) => `${types} · ${from} → ${to} · ${nights}`,
    states: { booked: "Резервирана — не е пристигнал", assigned: "Дадена е стая", in_house: "В хотела", departed: "Напуснал", cancelled: "Анулирана" },
    dueOutToday: "Напуска днес",
    sharedRecord: "Един общ запис в две фази — търговските полета по-долу са записани от RevioCRS или канала при резервацията, а PMS допълва същия запис с оперативните данни. Никога не е синхронизирано копие.",
    registerKept: "Този запис в регистъра съдържа данни и не може да бъде изтрит — регистърът се пази две години. Коригирайте го вместо това.",
    occupancyError: "Този брой гости не се побира в стаята. Стая за двама не може да се продаде на трима — първо преместете престоя в по-голям тип стая.",
    commercial: "Търговски данни",
    commercialSub: "От RevioCRS или канала · само за преглед",
    source: "Източник",
    ratePlan: "Ценови план",
    mealPlan: "Изхранване",
    roomOnly: "Само нощувка",
    cancellation: "Анулиране",
    paymentTerms: "Условия за плащане",
    payLabels: { card_on_file: "Карта като гаранция", company_account: "Фирмена сметка", prepaid_ota: "Предплатено (OTA)", none: "Няма" },
    roomsGuests: "Стаи · гости",
    total: "Обща стойност",
    note: (n) => `Бележка: ${n}`,
    operational: "Оперативни данни",
    operationalSub: "Задават се тук, в обекта",
    assignedRoom: "Стая",
    notAssigned: "Все още няма стая — дава се при настаняване",
    stayState: "Състояние на престоя",
    guestsInRoom: "Гости в стаята",
    ofMax: (n) => `от максимум ${n}`,
    update: "Обнови",
    occupancyNote: "Промяната преизчислява оставащите нощувки при цена на човек. Вече изминалите нощувки остават на цената, на която са продадени.",
    folioBalance: "Салдо по сметката",
    noFolio: "Все още няма сметка",
    deposits: "Депозити",
    held: (a) => `${a} задържани`,
    noDeposit: "Няма депозит",
    openFolio: "Отвори сметката",
    postCharge: "Начисли",
    reopenPlaceholder: "Защо отваряте престоя отново?",
    reopenTitle: "Отваряне на престоя отново — стаите не са запазени, затова гостът ще трябва да бъде настанен отново",
    managerOnly: "Нужно е одобрение от управител",
    reopen: "Отвори престоя отново",
    timeline: "История",
    timelineSub: "Резервация → стая → настаняване → преместване → начисления → напускане",
    events: {
      booking: "Получена резервация",
      assigned: (r) => `Дадена е стая ${r}`,
      moved: (r) => `Преместен в стая ${r}`,
      checkin: (r) => `Настанен — стая ${r}`,
      checkout: (r) => `Напуснал — стая ${r}`,
      charge: "Начисление",
      payment: "Записано плащане",
      cancel: "Анулирана",
    },
  },
};
