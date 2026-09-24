import type { Translations } from "@revio/ui/i18n";

/** Check-in, walk-in and room move — the three things a receptionist does with a guest at the desk. */
export interface StaysStrings {
  backToDesk: string;
  somethingWrong: string;
  occupied: string;
  checkin: {
    title: (guest: string) => string;
    subtitle: (from: string, to: string, rooms: string) => string;
    departedTitle: string;
    departedBody: (date: string) => string;
    backToDeskButton: string;
    openReservation: string;
    alreadyTitle: string;
    alreadyBody: (rooms: string) => string;
    roomSlot: (n: number | "") => string;
    free: (n: number) => string;
    suggested: (reason: string) => string;
    selectRoom: string;
    override: string;
    noneFree: string;
    errors: Record<"pick" | "dup" | "type" | "dirty" | "busy", string>;
    reasons: Record<string, string>;
  };
  walkin: {
    title: string;
    subtitle: string;
    needsSetup: string;
    firstName: string;
    lastName: string;
    firstNamePlaceholder: string;
    lastNamePlaceholder: string;
    roomType: string;
    maxGuests: (name: string, n: number) => string;
    nights: string;
    guests: string;
    rateNote: string;
    submit: string;
    errors: Record<"fields" | "full" | "norate" | "taken", string>;
  };
  move: {
    title: (guest: string) => string;
    subtitle: (unit: string, type: string, from: string, to: string) => string;
    otherTypesNote: [string, string, string];
    noneFree: string;
    moveTo: string;
    sameType: (type: string) => string;
    otherType: (type: string) => string;
    reason: string;
    reasons: { request: string; upgrade: string; maintenance: string; noise: string };
    footnote: (unit: string) => string;
    submit: string;
    errors: Record<"pick" | "busy", string>;
  };
}

export const stays: Translations<StaysStrings> = {
  en: {
    backToDesk: "Front Desk",
    somethingWrong: "Something went wrong — try again.",
    occupied: "Occupied",
    checkin: {
      title: (g) => `Check in — ${g}`,
      subtitle: (from, to, rooms) => `${from} → ${to} · ${rooms}`,
      departedTitle: "This stay has already checked out",
      departedBody: (d) => `It left on ${d}. A returning guest needs a new reservation. If this one was checked out by mistake, a manager can reopen it — the rooms are not held, so it will need checking in again.`,
      backToDeskButton: "Back to Front Desk",
      openReservation: "Open the reservation",
      alreadyTitle: "Already checked in",
      alreadyBody: (rooms) => `This reservation is in house (${rooms}).`,
      roomSlot: (n) => `Room ${n}`,
      free: (n) => `(${n} free)`,
      suggested: (r) => `Suggested · ${r}`,
      selectRoom: "Select a room…",
      override: "Allow override (assign a room that isn’t clean or is a different type — logged)",
      noneFree: "No clean, free rooms of this type right now. Tick “Allow override” to assign one anyway, or clean a room first.",
      errors: {
        pick: "Select a room for every slot.",
        dup: "Each room can only be assigned once.",
        type: "That room is a different room type — tick “Allow override” to assign it anyway.",
        dirty: "That room isn’t clean/inspected — tick “Allow override” to assign it anyway.",
        busy: "That room is already occupied for these dates.",
      },
      reasons: { "guest’s usual floor": "guest’s usual floor", inspected: "inspected", "next available room": "next available room" },
    },
    walkin: {
      title: "Walk-in",
      subtitle: "Create a same-day booking and check the guest straight in.",
      needsSetup: "This property needs room types and a standard rate plan before walk-ins work. Configure them in RevioLink / RevioCRS.",
      firstName: "First name",
      lastName: "Last name",
      firstNamePlaceholder: "Maria",
      lastNamePlaceholder: "Ivanova",
      roomType: "Room type",
      maxGuests: (name, n) => `${name} (max ${n})`,
      nights: "Nights",
      guests: "Guests",
      rateNote: "The room rate is taken from the standard plan for the stay. Payment is recorded later on the folio — no card is handled here.",
      submit: "Create & check in",
      errors: {
        fields: "Enter the guest’s name and pick a room type.",
        full: "No free, clean room of that type right now — clean or free a room first.",
        norate: "This property has no standard rate plan yet — set one up in RevioLink / RevioCRS first.",
        taken: "Somebody put another guest in that room a moment ago. Nothing was saved — press Create again and a free room will be picked.",
      },
    },
    move: {
      title: (g) => `Move room — ${g}`,
      subtitle: (unit, type, from, to) => `Currently in ${unit} · ${type} · ${from} → ${to}`,
      otherTypesNote: ["Rooms of another type are listed too. Moving to one does", "not", "change what the guest booked and sends nothing to any channel — but if it prices differently you will be asked to charge or comp the difference."],
      noneFree: "No free, serviceable room available for these dates — in any room type.",
      moveTo: "Move to",
      sameType: (t) => `${t} — same as booked`,
      otherType: (t) => `${t} — different type, affects the rate`,
      reason: "Reason",
      reasons: { request: "Guest request", upgrade: "Upgrade", maintenance: "Maintenance", noise: "Noise" },
      footnote: (u) => `The guest keeps the same stay; ${u} is set dirty for housekeeping. The reason is logged to the room timeline.`,
      submit: "Move room",
      errors: { pick: "Pick a different room to move to.", busy: "That room is already occupied for these dates." },
    },
  },
  bg: {
    backToDesk: "Рецепция",
    somethingWrong: "Нещо се обърка — опитайте отново.",
    occupied: "Заета",
    checkin: {
      title: (g) => `Настаняване — ${g}`,
      subtitle: (from, to, rooms) => `${from} → ${to} · ${rooms}`,
      departedTitle: "Този престой вече е приключил",
      departedBody: (d) => `Гостът е напуснал на ${d}. За завръщащ се гост е нужна нова резервация. Ако напускането е отбелязано по грешка, управител може да го отмени — стаите не са запазени, затова гостът ще трябва да бъде настанен отново.`,
      backToDeskButton: "Обратно към рецепцията",
      openReservation: "Отвори резервацията",
      alreadyTitle: "Гостът вече е настанен",
      alreadyBody: (rooms) => `Тази резервация е в хотела (${rooms}).`,
      roomSlot: (n) => `Стая ${n}`,
      free: (n) => `(${n} свободни)`,
      suggested: (r) => `Предложение · ${r}`,
      selectRoom: "Изберете стая…",
      override: "Разреши изключение (стая, която не е почистена или е от друг тип — записва се)",
      noneFree: "В момента няма чиста свободна стая от този тип. Отметнете „Разреши изключение“, за да настаните все пак, или първо почистете стая.",
      errors: {
        pick: "Изберете стая за всяко място.",
        dup: "Всяка стая може да бъде дадена само веднъж.",
        type: "Стаята е от друг тип — отметнете „Разреши изключение“, за да я дадете все пак.",
        dirty: "Стаята не е почистена или проверена — отметнете „Разреши изключение“, за да я дадете все пак.",
        busy: "Стаята вече е заета за тези дати.",
      },
      reasons: { "guest’s usual floor": "обичайният етаж на госта", inspected: "проверена", "next available room": "следващата свободна стая" },
    },
    walkin: {
      title: "Гост без резервация",
      subtitle: "Създайте резервация за днес и настанете госта веднага.",
      needsSetup: "Обектът има нужда от типове стаи и основен ценови план, преди да приема гости без резервация. Настройте ги в RevioLink или RevioCRS.",
      firstName: "Име",
      lastName: "Фамилия",
      firstNamePlaceholder: "Мария",
      lastNamePlaceholder: "Иванова",
      roomType: "Тип стая",
      maxGuests: (name, n) => `${name} (до ${n})`,
      nights: "Нощувки",
      guests: "Гости",
      rateNote: "Цената се взима от основния ценови план за престоя. Плащането се записва по-късно в сметката — тук не се въвежда карта.",
      submit: "Създай и настани",
      errors: {
        fields: "Въведете името на госта и изберете тип стая.",
        full: "В момента няма свободна чиста стая от този тип — първо почистете или освободете стая.",
        norate: "Обектът още няма основен ценови план — създайте го първо в RevioLink или RevioCRS.",
        taken: "Преди миг някой настани друг гост в тази стая. Нищо не е записано — натиснете отново и ще бъде избрана свободна стая.",
      },
    },
    move: {
      title: (g) => `Преместване — ${g}`,
      subtitle: (unit, type, from, to) => `Сега в ${unit} · ${type} · ${from} → ${to}`,
      otherTypesNote: ["Показани са и стаи от друг тип. Преместването в такава", "не", "променя резервацията на госта и не изпраща нищо към каналите — но ако цената е различна, ще бъдете попитани дали да начислите или опростите разликата."],
      noneFree: "За тези дати няма свободна изправна стая — от никой тип.",
      moveTo: "Премести в",
      sameType: (t) => `${t} — същият тип като резервацията`,
      otherType: (t) => `${t} — друг тип, влияе на цената`,
      reason: "Причина",
      reasons: { request: "По желание на госта", upgrade: "Надграждане", maintenance: "Ремонт", noise: "Шум" },
      footnote: (u) => `Гостът запазва същия престой; стая ${u} се маркира като мръсна за хаускийпинга. Причината се записва в историята на стаята.`,
      submit: "Премести",
      errors: { pick: "Изберете друга стая, в която да преместите госта.", busy: "Стаята вече е заета за тези дати." },
    },
  },
};
