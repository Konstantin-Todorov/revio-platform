import type { Translations } from "./i18n";

/**
 * What every product says when `@revio/core`'s room rules (`rooms/room-rules.ts`) refuse or step
 * aside — deleting a room type something depends on, a room number that already exists, more doors
 * than the type is sold with. One module, because the three products ask the same questions of the
 * same rows and must answer them in the same words.
 *
 * Strings only, `{name}` placeholders filled with `fill()`. Counts are written as "{n} ×" or as a
 * figure after a colon, so no sentence here needs a plural form.
 */
export interface RoomRulesStrings {
  /** "{name}" */
  deactivated: string;
  /** "{name}" */
  inUseWelcome: string;
  /** "{name}" */
  mappedWelcome: string;
  /** "{label}" */
  labelTaken: string;
  allExist: string;
  /** "{type}" "{total}" "{existing}" "{left}" "{where}" */
  overCapacity: string;
  /** "{type}" "{total}" "{existing}" "{where}" */
  overCapacityFull: string;
  /** "{list}" */
  skipped: string;
  whereHere: string;
  /** "{product}" */
  whereProduct: string;
  /** "{type}" "{existing}" */
  countBelowRooms: string;
  editor: {
    title: string;
    lead: string;
    /** "{product}" */
    managedIn: string;
    name: string;
    namePlaceholder: string;
    count: string;
    guests: string;
    save: string;
    saving: string;
    add: string;
    adding: string;
    remove: string;
    /** "{name}" */
    removeConfirm: string;
    removeNote: string;
    inactive: string;
    saved: string;
  };
}

export const roomRulesStrings: Translations<RoomRulesStrings> = {
  en: {
    deactivated:
      "{name} has bookings or physical rooms behind it, so it was switched off instead of deleted — its history and its rooms stay exactly as they were.",
    inUseWelcome:
      "{name} already has bookings or physical rooms behind it, so it cannot be removed here. Change it in Rooms & Rates instead.",
    mappedWelcome: "{name} is still sold on a channel. Unmap it in Mapping first, then remove it.",
    labelTaken: "There is already a room {label} at this property. Give this one a different number.",
    allExist: "Every one of those room numbers already exists — nothing was added.",
    overCapacity:
      "{total} × {type} are for sale and {existing} already exist here, so {left} more can be added. If the hotel really has more, raise the number of {type} rooms {where} first — nothing was added.",
    overCapacityFull:
      "{total} × {type} are for sale and all {existing} already exist here. If the hotel really has more, raise the number of {type} rooms {where} first — nothing was added.",
    skipped: "Added. {list} already existed and were left as they were.",
    whereHere: "under Room types on this page",
    whereProduct: "in {product} → Rooms & Rates",
    countBelowRooms:
      "{type} already has {existing} physical rooms, so its count cannot go below {existing}. Remove the rooms you no longer have first.",
    editor: {
      title: "Room types",
      lead: "What you sell — a name, how many of them the hotel has, and how many guests fit in one. The physical rooms below hang off these.",
      managedIn: "Room types and how many of each you sell are managed in {product} → Rooms & Rates, so every product reads the same numbers.",
      name: "Name",
      namePlaceholder: "Double Room",
      count: "Rooms",
      guests: "Max guests",
      save: "Save",
      saving: "Saving…",
      add: "Add room type",
      adding: "Adding…",
      remove: "Remove",
      removeConfirm: "Remove {name}?",
      removeNote: "One with bookings or physical rooms behind it is switched off instead, so nothing is lost.",
      inactive: "switched off",
      saved: "Saved.",
    },
  },
  bg: {
    deactivated:
      "{name} има резервации или физически стаи, затова е изключен, а не изтрит — историята и стаите му остават точно както са.",
    inUseWelcome:
      "{name} вече има резервации или физически стаи, затова не може да се премахне оттук. Променете го от „Стаи и цени“.",
    mappedWelcome: "{name} все още се продава в канал. Първо премахнете съответствието му в „Съответствия“, после го изтрийте.",
    labelTaken: "В обекта вече има стая {label}. Дайте на тази друг номер.",
    allExist: "Всички тези номера на стаи вече съществуват — нищо не е добавено.",
    overCapacity:
      "За продажба са {total} × {type}, а тук вече има {existing}, затова могат да се добавят още {left}. Ако в хотела наистина са повече, първо увеличете броя на {type} {where} — нищо не е добавено.",
    overCapacityFull:
      "За продажба са {total} × {type} и всичките {existing} вече са тук. Ако в хотела наистина са повече, първо увеличете броя на {type} {where} — нищо не е добавено.",
    skipped: "Добавено. {list} вече съществуваха и са оставени както са.",
    whereHere: "в „Типове стаи“ на тази страница",
    whereProduct: "в {product} → Стаи и цени",
    countBelowRooms:
      "{type} вече има {existing} физически стаи, затова броят не може да е по-малък от {existing}. Първо премахнете стаите, които вече нямате.",
    editor: {
      title: "Типове стаи",
      lead: "Това, което продавате — име, колко такива има хотелът и колко гости побира една. Физическите стаи по-долу се закачат за тях.",
      managedIn: "Типовете стаи и колко от всеки продавате се управляват в {product} → Стаи и цени, за да четат всички продукти едни и същи числа.",
      name: "Име",
      namePlaceholder: "Двойна стая",
      count: "Стаи",
      guests: "Макс. гости",
      save: "Запази",
      saving: "Запазване…",
      add: "Добави тип стая",
      adding: "Добавяне…",
      remove: "Премахни",
      removeConfirm: "Премахване на {name}?",
      removeNote: "Тип с резервации или физически стаи се изключва вместо това, така че нищо не се губи.",
      inactive: "изключен",
      saved: "Запазено.",
    },
  },
};
