import type { Translations } from "@revio/ui/i18n";

/** RevioPMS's own first-run forms (rooms and doors). **Strings only** — client components. */
export interface WelcomeFormStrings {
  roomType: string;
  roomTypePlaceholder: string;
  howMany: string;
  sleeps: string;
  adding: string;
  addRoomType: string;
  floor: string;
  startAt: string;
  howManyRooms: string;
  rangeHint: string;
  addRooms: string;
}

/** RevioPMS's first-run screens — what the shared frame and fields do not already say. */
export interface WelcomePageStrings {
  meta: string;
  roomsLine: (rooms: number, sleeps: number) => string;
  remove: string;
  floor: (f: string) => string;
  roomTypeFirst: string;
  roomsReady: (n: number) => string;
  teamBody: string;
  addTeam: string;
  ready: { rooms: string; roomsValue: (n: number) => string; timezone: string; checkInOut: string };
  keptShortBefore: (rooms: number) => string;
  addingTeam: string;
  keptShortAfter: string;
  readyBody: string;
  finish: string;
  forms: WelcomeFormStrings;
  errors: {
    notManager: string;
    noPermission: string;
    chooseRoomType: string;
    startAt: string;
    howMany: string;
    exist: string;
  };
}

export const welcome: Translations<WelcomePageStrings> = {
  en: {
    meta: "Set up RevioPMS",
    roomsLine: (r, s) => `${r} room${r === 1 ? "" : "s"} · sleeps ${s}`,
    remove: "Remove",
    floor: (f) => ` · floor ${f}`,
    roomTypeFirst: "Add a room type first — every room belongs to one.",
    roomsReady: (n) => `${n} room${n === 1 ? "" : "s"} ready for housekeeping.`,
    teamBody: "Reception, housekeeping and maintenance each see only the screens they need. Everyone gets their own login and sets their own password from an invitation.",
    addTeam: "Add your team",
    ready: { rooms: "Rooms", roomsValue: (n) => `${n} physical room${n === 1 ? "" : "s"}`, timezone: "Time zone", checkInOut: "Check-in / out" },
    keptShortBefore: (r) => `Because you have ${r} rooms we kept setup short and didn’t ask about`,
    addingTeam: "adding your team",
    keptShortAfter: ". It is on your dashboard checklist whenever you want it.",
    readyBody: "Reception can check a guest in, and every room is on the housekeeping board.",
    finish: "Finish setup",
    forms: {
      roomType: "Room type",
      roomTypePlaceholder: "Double Room",
      howMany: "How many",
      sleeps: "Sleeps",
      adding: "Adding…",
      addRoomType: "Add room type",
      floor: "Floor (optional)",
      startAt: "Numbers start at",
      howManyRooms: "How many rooms",
      rangeHint: "Starting at 101 with 10 rooms creates 101 through 110.",
      addRooms: "Add these rooms",
    },
    errors: {
      notManager: "Only an Owner, Admin or Manager can complete setup.",
      noPermission: "You don’t have permission to do that. Setting the property up is a manager’s job.",
      chooseRoomType: "Choose a room type.",
      startAt: "Where do the numbers start? For example 101.",
      howMany: "How many rooms? Up to 200 at a time.",
      exist: "Those room numbers already exist.",
    },
  },
  bg: {
    meta: "Настройка на RevioPMS",
    roomsLine: (r, s) => `${r} ${r === 1 ? "стая" : "стаи"} · за ${s} ${s === 1 ? "човек" : "души"}`,
    remove: "Премахни",
    floor: (f) => ` · етаж ${f}`,
    roomTypeFirst: "Първо добавете тип стая — всяка стая принадлежи на тип.",
    roomsReady: (n) => `${n} ${n === 1 ? "стая е готова" : "стаи са готови"} за хаускийпинга.`,
    teamBody: "Рецепцията, хаускийпингът и поддръжката виждат само екраните, които им трябват. Всеки получава собствен вход и сам избира паролата си от покана.",
    addTeam: "Добавете екипа си",
    ready: { rooms: "Стаи", roomsValue: (n) => `${n} ${n === 1 ? "физическа стая" : "физически стаи"}`, timezone: "Часова зона", checkInOut: "Настаняване / напускане" },
    keptShortBefore: (r) => `Тъй като имате ${r} стаи, направихме настройката кратка и не питахме за`,
    addingTeam: "добавянето на екипа",
    keptShortAfter: ". То е в списъка със задачи на таблото, когато решите.",
    readyBody: "Рецепцията вече може да настанява гости, а всяка стая е на таблото на хаускийпинга.",
    finish: "Завърши настройката",
    forms: {
      roomType: "Тип стая",
      roomTypePlaceholder: "Двойна стая",
      howMany: "Брой",
      sleeps: "Места",
      adding: "Добавяне…",
      addRoomType: "Добави тип стая",
      floor: "Етаж (по желание)",
      startAt: "Номерата започват от",
      howManyRooms: "Брой стаи",
      rangeHint: "От 101 с 10 стаи се създават стаи от 101 до 110.",
      addRooms: "Добави тези стаи",
    },
    errors: {
      notManager: "Само собственик, администратор или управител може да завърши настройката.",
      noPermission: "Нямате права за това. Настройката на обекта е работа на управителя.",
      chooseRoomType: "Изберете тип стая.",
      startAt: "От кой номер започват стаите? Например 101.",
      howMany: "Колко стаи? До 200 наведнъж.",
      exist: "Тези номера на стаи вече съществуват.",
    },
  },
};
