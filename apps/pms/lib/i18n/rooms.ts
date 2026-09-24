import type { Translations } from "@revio/ui/i18n";

/** Rooms — the physical doors — and each room's lifecycle history. */
export interface RoomsStrings {
  title: string;
  subtitle: (property: string, rooms: number, types: number) => string;
  noTypes: string;
  noTypesBody: string;
  blocked: (room: string) => string;
  blockedBody: string;
  created: (n: number, bed: boolean) => string;
  cap: (n: number) => string;
  over: string;
  addRooms: string;
  noRooms: string;
  historyAria: (room: string) => string;
  historyTitle: string;
  editAria: (room: string) => string;
  deleteAria: (room: string) => string;
  deleteConfirm: (room: string) => string;
  roomName: string;
  floor: string;
  floorPlaceholder: string;
  /** The Floors card at the top of Rooms — strings only, the manager is a client component. */
  floors: {
    title: string;
    subtitle: string;
    noFloor: string;
    /** "{n} rooms" */
    roomsOne: string;
    roomsMany: string;
    /** "Floor {floor}" — only for a bare number; a named floor ("Ground", "Annex") shows as typed. */
    numbered: string;
    arrange: string;
    close: string;
    whichFloor: string;
    whichFloorPlaceholder: string;
    whichFloorHint: string;
    whichRooms: string;
    selectAll: string;
    selectNone: string;
    save: string;
    saving: string;
    empty: string;
  };
  roomPlaceholder: string;
  features: string;
  featureLabels: Record<string, string>;
  connecting: string;
  connectingNote: string;
  saveAttributes: string;
  cancel: string;
  connected: (rooms: string) => string;
  adding: string;
  addOne: string;
  prefix: string;
  none: string;
  start: string;
  howMany: string;
  generating: string;
  generate: string;
  generateNote: string;
  timeline: {
    back: string;
    title: (room: string) => string;
    subtitle: (type: string, floor: string | null) => string;
    card: string;
    cardSub: string;
    empty: string;
    footnote: string;
    hk: Record<string, string>;
    statusTo: (s: string) => string;
    issueReported: string;
    issueLogged: (title: string) => string;
    tookOoo: string;
    priority: (p: string) => string;
    repaired: (title: string) => string;
    backInService: string;
    checkedIn: (name: string) => string;
    checkedOut: (name: string) => string;
  };
}

export const rooms: Translations<RoomsStrings> = {
  en: {
    title: "Rooms",
    subtitle: (p, r, t) => `${p} · ${r} physical room${r === 1 ? "" : "s"} across ${t} room type${t === 1 ? "" : "s"}`,
    noTypes: "No room types on this property",
    noTypesBody: "Room types are defined in RevioLink / RevioCRS (Rooms & Rates). Once a property has room types, add the individual physical rooms here.",
    blocked: (r) => `Room ${r} can’t be deleted.`,
    blockedBody: "It’s occupied or assigned to a current/future stay — check the guest out or reassign the stay first.",
    created: (n, bed) => `${n} ${bed ? "bed" : "room"}${n === 1 ? "" : "s"} created ·`,
    cap: (n) => `physical cap ${n}`,
    over: "· over physical count",
    addRooms: "Add rooms",
    noRooms: "No rooms yet — use “Add rooms”.",
    historyAria: (r) => `Lifecycle history for room ${r}`,
    historyTitle: "Room lifecycle timeline",
    editAria: (r) => `Edit attributes for room ${r}`,
    deleteAria: (r) => `Delete room ${r}`,
    deleteConfirm: (r) => `Delete room ${r}? Blocked if it’s occupied or assigned to a stay.`,
    roomName: "Room number / name",
    floor: "Floor / zone",
    floorPlaceholder: "Floor 1",
    floors: {
      title: "Floors",
      subtitle: "Floors group your rooms on the calendar and on the housekeeping board.",
      noFloor: "No floor yet",
      roomsOne: "1 room",
      roomsMany: "{n} rooms",
      numbered: "Floor {floor}",
      arrange: "Arrange rooms by floor",
      close: "Close",
      whichFloor: "Floor",
      whichFloorPlaceholder: "e.g. 1, 2 or Ground",
      whichFloorHint: "Type a number — “1” shows as “Floor 1”. Leave it empty to take the ticked rooms off any floor.",
      whichRooms: "Which rooms are on this floor?",
      selectAll: "Tick all",
      selectNone: "Clear",
      save: "Save floor",
      saving: "Saving…",
      empty: "No room has a floor yet. Use “Arrange rooms by floor” to set them all at once.",
    },
    roomPlaceholder: "e.g. 101",
    features: "Features",
    featureLabels: { quiet: "Quiet", accessible: "Accessible", view: "View", smoking: "Smoking" },
    connecting: "Connecting rooms",
    connectingNote: "Cmd/Ctrl-click to select multiple. Links stay two-way and feed the one-room-in-progress rule + family/group assignment.",
    saveAttributes: "Save attributes",
    cancel: "Cancel",
    connected: (r) => `Connected: ${r}`,
    adding: "Adding…",
    addOne: "Add one",
    prefix: "Prefix",
    none: "(none)",
    start: "Start #",
    howMany: "How many",
    generating: "Generating…",
    generate: "Generate",
    generateNote: "Generate makes numbered rooms (e.g. prefix “A”, start 101, 10 rooms → A101…A110).",
    timeline: {
      back: "Rooms",
      title: (r) => `Room ${r}`,
      subtitle: (t, f) => `${t}${f ? ` · ${f}` : ""} · lifecycle history`,
      card: "Room timeline",
      cardSub: "Cleaned → issue reported → out of order → repaired → back in service — from housekeeping, maintenance and moves",
      empty: "No recorded history for this room yet. Housekeeping, maintenance and guest activity will build up here.",
      footnote: "The per-room history pairs with the reservation timeline — one for the room, one for the stay.",
      hk: { clean: "Cleaned", in_progress: "Cleaning started", inspected: "Inspected", dirty: "Marked dirty", out_of_order: "Out of order (housekeeping)" },
      statusTo: (s) => `Status → ${s}`,
      issueReported: "Issue reported (housekeeping)",
      issueLogged: (t) => `Issue logged: ${t}`,
      tookOoo: "took the room out of order",
      priority: (p) => `priority ${p}`,
      repaired: (t) => `Repaired: ${t}`,
      backInService: "back in service",
      checkedIn: (n) => `${n} checked in`,
      checkedOut: (n) => `${n} checked out`,
    },
  },
  bg: {
    title: "Стаи",
    subtitle: (p, r, t) => `${p} · ${r} ${r === 1 ? "физическа стая" : "физически стаи"} в ${t} ${t === 1 ? "тип" : "типа"}`,
    noTypes: "Обектът няма типове стаи",
    noTypesBody: "Типовете стаи се създават в RevioLink или RevioCRS (Стаи и цени). След това добавете тук отделните физически стаи.",
    blocked: (r) => `Стая ${r} не може да бъде изтрита.`,
    blockedBody: "Заета е или е дадена за текущ или бъдещ престой — първо изпишете госта или му дайте друга стая.",
    created: (n, bed) => `${n} ${bed ? (n === 1 ? "легло" : "легла") : (n === 1 ? "стая" : "стаи")} ·`,
    cap: (n) => `физически ${n}`,
    over: "· повече от физическия брой",
    addRooms: "Добави стаи",
    noRooms: "Още няма стаи — използвайте „Добави стаи“.",
    historyAria: (r) => `История на стая ${r}`,
    historyTitle: "История на стаята",
    editAria: (r) => `Редактирай стая ${r}`,
    deleteAria: (r) => `Изтрий стая ${r}`,
    deleteConfirm: (r) => `Да се изтрие ли стая ${r}? Няма да стане, ако е заета или дадена за престой.`,
    roomName: "Номер / име на стаята",
    floor: "Етаж / зона",
    floorPlaceholder: "Етаж 1",
    floors: {
      title: "Етажи",
      subtitle: "Етажите групират стаите в календара и на таблото на хаускийпинга.",
      noFloor: "Все още без етаж",
      roomsOne: "1 стая",
      roomsMany: "{n} стаи",
      numbered: "Етаж {floor}",
      arrange: "Подреди стаите по етажи",
      close: "Затвори",
      whichFloor: "Етаж",
      whichFloorPlaceholder: "напр. 1, 2 или Приземен",
      whichFloorHint: "Въведете число — „1“ се показва като „Етаж 1“. Оставете празно, за да махнете етажа на отметнатите стаи.",
      whichRooms: "Кои стаи са на този етаж?",
      selectAll: "Отметни всички",
      selectNone: "Изчисти",
      save: "Запази етажа",
      saving: "Запазване…",
      empty: "Все още никоя стая няма етаж. Използвайте „Подреди стаите по етажи“, за да ги зададете наведнъж.",
    },
    roomPlaceholder: "напр. 101",
    features: "Особености",
    featureLabels: { quiet: "Тиха", accessible: "Достъпна", view: "С гледка", smoking: "За пушачи" },
    connecting: "Свързани стаи",
    connectingNote: "Cmd/Ctrl + клик за няколко. Връзката важи в двете посоки и се ползва от правилото „по една стая наведнъж“ и при настаняване на семейства и групи.",
    saveAttributes: "Запази",
    cancel: "Отказ",
    connected: (r) => `Свързана с: ${r}`,
    adding: "Добавяне…",
    addOne: "Добави една",
    prefix: "Префикс",
    none: "(без)",
    start: "Начален №",
    howMany: "Брой",
    generating: "Създаване…",
    generate: "Създай",
    generateNote: "„Създай“ прави номерирани стаи (напр. префикс „A“, начало 101, 10 стаи → A101…A110).",
    timeline: {
      back: "Стаи",
      title: (r) => `Стая ${r}`,
      subtitle: (t, f) => `${t}${f ? ` · ${f}` : ""} · история`,
      card: "История на стаята",
      cardSub: "Почистена → съобщен проблем → извън експлоатация → ремонтирана → отново в продажба — от хаускийпинга, поддръжката и преместванията",
      empty: "Все още няма история за тази стая. Тук ще се натрупва хаускийпинг, поддръжка и гости.",
      footnote: "Историята на стаята върви заедно с историята на резервацията — едната за стаята, другата за престоя.",
      hk: { clean: "Почистена", in_progress: "Започнато почистване", inspected: "Проверена", dirty: "Маркирана като мръсна", out_of_order: "Извън експлоатация (хаускийпинг)" },
      statusTo: (s) => `Статус → ${s}`,
      issueReported: "Съобщен проблем (хаускийпинг)",
      issueLogged: (t) => `Записан проблем: ${t}`,
      tookOoo: "стаята е спряна от продажба",
      priority: (p) => `спешност: ${p}`,
      repaired: (t) => `Ремонтирано: ${t}`,
      backInService: "отново в продажба",
      checkedIn: (n) => `${n} — настанен`,
      checkedOut: (n) => `${n} — напуснал`,
    },
  },
};
