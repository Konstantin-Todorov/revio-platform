import type { Translations } from "@revio/ui/i18n";

/**
 * RevioCRS's first-run screens — what the shared frame (`@revio/ui/welcome-strings`) and the shared
 * field groups do not already say: the room list, the starting price, the team step and the last
 * screen. The step titles and leads come from the shared dictionary via `welcomeStepText`, the same
 * as RevioPMS.
 */
export interface WelcomeFormStrings {
  roomType: string;
  roomTypePlaceholder: string;
  howMany: string;
  sleeps: string;
  adding: string;
  addRoomType: string;
  nightly: (currency: string) => string;
  nightlyPlaceholder: string;
  appliedTo: (count: number) => string;
  setPrice: string;
  useThis: string;
}

export interface WelcomePageStrings {
  meta: string;
  roomsLine: (rooms: number, sleeps: number) => string;
  remove: string;
  roomsTotal: (n: number) => string;
  teamBody: string;
  inviteTeam: string;
  ready: { rooms: string; roomsValue: (n: number) => string; currency: string; timezone: string; checkInOut: string };
  keptShortBefore: (rooms: number) => string;
  addingTeam: string;
  keptShortAfter: string;
  readyBody: string;
  finish: string;
  forms: WelcomeFormStrings;
  errors: { expired: string; colour: string; logo: string };
}

export const welcome: Translations<WelcomePageStrings> = {
  en: {
    meta: "Set up RevioCRS",
    roomsLine: (r, s) => `${r} room${r === 1 ? "" : "s"} · sleeps ${s}`,
    remove: "Remove",
    roomsTotal: (n) => `${n} room${n === 1 ? "" : "s"} in total.`,
    teamBody: "Everyone gets their own login and sets their own password from an invitation. Nobody ever shares one — and the same login works in every Revio product your hotel uses.",
    inviteTeam: "Invite your team",
    ready: { rooms: "Rooms", roomsValue: (n) => `${n} across your room types`, currency: "Currency", timezone: "Time zone", checkInOut: "Check-in / out" },
    keptShortBefore: (r) => `Because you have ${r} rooms we kept setup short and didn’t ask about `,
    addingTeam: "adding your team",
    keptShortAfter: ". It is on your dashboard checklist whenever you want it.",
    readyBody: "You can take a booking now: search availability, hold the room, confirm.",
    finish: "Finish setup",
    forms: {
      roomType: "Room type",
      roomTypePlaceholder: "Double Room",
      howMany: "How many",
      sleeps: "Sleeps",
      adding: "Adding…",
      addRoomType: "Add room type",
      nightly: (c) => `Nightly price (${c})`,
      nightlyPlaceholder: "e.g. 120",
      appliedTo: (n) => `Applied to ${n === 1 ? "your room type" : `all ${n} room types`} for the next 180 nights. Availability search can quote a stay as soon as this exists.`,
      setPrice: "Set this price",
      useThis: "Use this",
    },
    errors: {
      expired: "Your session expired — sign in again.",
      colour: "Use a colour like #0E7C86.",
      logo: "The logo link needs to start with https://",
    },
  },
  bg: {
    meta: "Настройка на RevioCRS",
    roomsLine: (r, s) => `${r} ${r === 1 ? "стая" : "стаи"} · до ${s} ${s === 1 ? "гост" : "гости"}`,
    remove: "Премахни",
    roomsTotal: (n) => `Общо ${n} ${n === 1 ? "стая" : "стаи"}.`,
    teamBody: "Всеки получава свой вход и сам задава паролата си от покана. Никой не споделя вход — и същият вход работи във всички продукти на Revio, които хотелът използва.",
    inviteTeam: "Поканете екипа си",
    ready: { rooms: "Стаи", roomsValue: (n) => `${n} във всички типове стаи`, currency: "Валута", timezone: "Часова зона", checkInOut: "Настаняване / напускане" },
    keptShortBefore: (r) => `Понеже имате ${r} ${r === 1 ? "стая" : "стаи"}, съкратихме настройката и не попитахме за `,
    addingTeam: "добавянето на екипа",
    keptShortAfter: ". Остава в списъка на таблото, когато решите.",
    readyBody: "Вече можете да приемете резервация: търсите наличност, задържате стаята, потвърждавате.",
    finish: "Приключи настройката",
    forms: {
      roomType: "Тип стая",
      roomTypePlaceholder: "Двойна стая",
      howMany: "Брой",
      sleeps: "Гости",
      adding: "Добавяне…",
      addRoomType: "Добави тип стая",
      nightly: (c) => `Цена за нощувка (${c})`,
      nightlyPlaceholder: "напр. 120",
      appliedTo: (n) => `Прилага се ${n === 1 ? "за типа стая" : `за всичките ${n} типа стаи`} за следващите 180 нощувки. Търсенето на наличност може да оферира престой веднага щом цената е зададена.`,
      setPrice: "Задай цената",
      useThis: "Използвай това",
    },
    errors: {
      expired: "Сесията Ви е изтекла — влезте отново.",
      colour: "Използвайте цвят като #0E7C86.",
      logo: "Линкът към логото трябва да започва с https://",
    },
  },
};
