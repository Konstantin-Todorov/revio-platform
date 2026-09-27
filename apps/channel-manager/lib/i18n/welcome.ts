import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's first-run screens — what the shared frame (`@revio/ui/welcome-strings`) and the shared
 * field groups do not already say: the room list, the starting price, where bookings go, the team
 * step and the last screen. Step titles and leads come from the shared dictionary via
 * `welcomeStepText`, as in RevioCRS and RevioPMS.
 */
export interface CmWelcomeFormStrings {
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
  sendTo: string;
  sendToPlaceholder: string;
  alsoTo: string;
  alsoToPlaceholder: string;
  tomorrow: string;
  tomorrowNote: string;
}

export interface CmWelcomePageStrings {
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
  nothingYet: string;
  connect: string;
  finishWithout: string;
  connected: (n: number) => string;
  finish: string;
  forms: CmWelcomeFormStrings;
  errors: { expired: string; colour: string; logo: string; deliveryMissing: string; deliveryBad: string; secondBad: string };
}

export const welcome: Translations<CmWelcomePageStrings> = {
  en: {
    meta: "Set up RevioLink",
    roomsLine: (r, s) => `${r} room${r === 1 ? "" : "s"} · sleeps ${s}`,
    remove: "Remove",
    roomsTotal: (n) => `${n} room${n === 1 ? "" : "s"} in total.`,
    teamBody: "Everyone who works with distribution gets their own login, and sets their own password from an invitation. Nobody ever shares one.",
    inviteTeam: "Invite your team",
    ready: { rooms: "Rooms", roomsValue: (n) => `${n} across your room types`, currency: "Currency", timezone: "Time zone", checkInOut: "Check-in / out" },
    keptShortBefore: (r) => `Because you have ${r} rooms we kept setup short and didn’t ask about `,
    addingTeam: "adding your team",
    keptShortAfter: ". It is on your dashboard checklist whenever you want it.",
    nothingYet: "Nothing has left Revio yet. The Channels screen sets your rooms up for distribution and then connects your first OTA — neither step puts anything on sale until you say so.",
    connect: "Connect a channel",
    finishWithout: "Finish setup without connecting yet",
    connected: (n) => `${n} channel${n === 1 ? "" : "s"} connected. Your rooms and prices go out on the next sync.`,
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
      appliedTo: (n) => `Applied to ${n === 1 ? "your room type" : `all ${n} room types`} for the next 180 nights. You can change any date afterwards on the calendar.`,
      setPrice: "Set this price",
      useThis: "Use this",
      sendTo: "Send bookings to",
      sendToPlaceholder: "reception@yourhotel.com",
      alsoTo: "And also to (optional)",
      alsoToPlaceholder: "owner@yourhotel.com",
      tomorrow: "Email tomorrow’s arrivals each evening",
      tomorrowNote: "A list the evening before is something reception can act on.",
    },
    errors: {
      expired: "Your session expired — sign in again.",
      colour: "Use a colour like #0E7C86.",
      logo: "The logo link needs to start with https://",
      deliveryMissing: "Enter the address your bookings should go to.",
      deliveryBad: "That email doesn't look right.",
      secondBad: "The second email doesn't look right.",
    },
  },
  bg: {
    meta: "Настройка на RevioLink",
    roomsLine: (r, s) => `${r} ${r === 1 ? "стая" : "стаи"} · до ${s} ${s === 1 ? "гост" : "гости"}`,
    remove: "Премахни",
    roomsTotal: (n) => `Общо ${n} ${n === 1 ? "стая" : "стаи"}.`,
    teamBody: "Всеки, който работи с дистрибуцията, получава свой вход и сам задава паролата си от покана. Никой не споделя вход.",
    inviteTeam: "Поканете екипа си",
    ready: { rooms: "Стаи", roomsValue: (n) => `${n} във всички типове стаи`, currency: "Валута", timezone: "Часова зона", checkInOut: "Настаняване / напускане" },
    keptShortBefore: (r) => `Понеже имате ${r} ${r === 1 ? "стая" : "стаи"}, съкратихме настройката и не попитахме за `,
    addingTeam: "добавянето на екипа",
    keptShortAfter: ". Остава в списъка на таблото, когато решите.",
    nothingYet: "Все още нищо не е излязло от Revio. Екранът „Канали“ подготвя стаите Ви за дистрибуция и после свързва първата OTA — нито една от двете стъпки не пуска нищо в продажба, докато не решите.",
    connect: "Свържи канал",
    finishWithout: "Приключи настройката, без да свързвам още",
    connected: (n) => `${n} ${n === 1 ? "свързан канал" : "свързани канала"}. Стаите и цените Ви излизат при следващата синхронизация.`,
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
      appliedTo: (n) => `Прилага се ${n === 1 ? "за типа стая" : `за всичките ${n} типа стаи`} за следващите 180 нощувки. После можете да промените всяка дата в календара.`,
      setPrice: "Задай цената",
      useThis: "Използвай това",
      sendTo: "Изпращай резервациите на",
      sendToPlaceholder: "reception@hotel.bg",
      alsoTo: "И на (по желание)",
      alsoToPlaceholder: "owner@hotel.bg",
      tomorrow: "Изпращай пристигащите за утре всяка вечер",
      tomorrowNote: "Списък от предишната вечер е нещо, с което рецепцията може да работи.",
    },
    errors: {
      expired: "Сесията Ви е изтекла — влезте отново.",
      colour: "Използвайте цвят като #0E7C86.",
      logo: "Линкът към логото трябва да започва с https://",
      deliveryMissing: "Въведете адреса, на който да отиват резервациите.",
      deliveryBad: "Този имейл не изглежда правилен.",
      secondBad: "Вторият имейл не изглежда правилен.",
    },
  },
};
