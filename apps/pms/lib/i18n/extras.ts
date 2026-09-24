import type { Translations } from "@revio/ui/i18n";

/** Extras & Charges — tap-to-post items to a guest's folio, and the catalog behind them. */
export interface ExtrasStrings {
  title: string;
  subtitle: string;
  manageCatalog: string;
  noRooms: string;
  noRoomsBefore: string;
  frontDesk: string;
  noRoomsAfter: string;
  outlets: Record<string, string>;
  stage: {
    room: (rooms: string) => string;
    subtitle: (guest: string) => string;
    folio: (balance: string) => string;
    closedError: string;
    closed: string;
    noItemsBefore: string;
    add: string;
    posted: string;
    voidTitle: string;
    voidNote: string;
  };
  catalog: {
    back: string;
    title: string;
    subtitle: (property: string) => string;
    priceError: string;
    fieldsError: string;
    addItem: string;
    name: string;
    namePlaceholder: string;
    outlet: string;
    type: string;
    item: string;
    extra: string;
    price: (currency: string) => string;
    adding: string;
    add: string;
    empty: string;
    active: string;
    save: string;
    delete: string;
  };
}

export const extras: Translations<ExtrasStrings> = {
  en: {
    title: "Extras & Charges",
    subtitle: "Pick a guest’s open folio to post minibar items, extras and other charges.",
    manageCatalog: "Manage catalog",
    noRooms: "No occupied rooms",
    noRoomsBefore: "Minibar charges post to an in-house guest’s folio. Check someone in from the",
    frontDesk: "Front Desk",
    noRoomsAfter: "first.",
    outlets: { minibar: "Minibar", spa: "Spa", bar: "Bar", restaurant: "Restaurant" },
    stage: {
      room: (r) => `Room ${r}`,
      subtitle: (g) => `${g} · tap an item to add it to the folio`,
      folio: (b) => `Folio · ${b}`,
      closedError: "This folio is closed — the guest has checked out.",
      closed: "This guest has checked out — the folio is closed.",
      noItemsBefore: "No catalog items yet. Add some in",
      add: "Add",
      posted: "Posted this stay",
      voidTitle: "Void this charge",
      voidNote: "Voiding keeps the line visible on the folio, struck through — nothing is deleted.",
    },
    catalog: {
      back: "Minibar / POS",
      title: "Catalog",
      subtitle: (p) => `${p} · items you can tap-to-post to a folio`,
      priceError: "That price isn’t a number. Enter an amount like 12.50.",
      fieldsError: "Enter a name and a positive price.",
      addItem: "Add an item",
      name: "Name",
      namePlaceholder: "e.g. Espresso",
      outlet: "Outlet",
      type: "Type",
      item: "Item",
      extra: "Extra",
      price: (c) => `Price (${c})`,
      adding: "Adding…",
      add: "Add",
      empty: "No catalog items yet.",
      active: "Active",
      save: "Save",
      delete: "Delete",
    },
  },
  bg: {
    title: "Екстри и такси",
    subtitle: "Изберете отворената сметка на гост, за да начислите минибар, допълнителни услуги и други такси.",
    manageCatalog: "Каталог",
    noRooms: "Няма заети стаи",
    noRoomsBefore: "Минибарът се начислява по сметката на гост в хотела. Първо настанете гост от",
    frontDesk: "Рецепцията",
    noRoomsAfter: ".",
    outlets: { minibar: "Минибар", spa: "СПА", bar: "Бар", restaurant: "Ресторант" },
    stage: {
      room: (r) => `Стая ${r}`,
      subtitle: (g) => `${g} · докоснете артикул, за да го добавите към сметката`,
      folio: (b) => `Сметка · ${b}`,
      closedError: "Сметката е затворена — гостът е напуснал.",
      closed: "Гостът е напуснал — сметката е затворена.",
      noItemsBefore: "Все още няма артикули. Добавете в",
      add: "Добави",
      posted: "Начислено за престоя",
      voidTitle: "Анулирай това начисление",
      voidNote: "Анулираният ред остава видим в сметката, зачеркнат — нищо не се изтрива.",
    },
    catalog: {
      back: "Минибар / ПОС",
      title: "Каталог",
      subtitle: (p) => `${p} · артикули, които се начисляват с едно докосване`,
      priceError: "Цената не е число. Въведете сума, напр. 12,50.",
      fieldsError: "Въведете име и положителна цена.",
      addItem: "Нов артикул",
      name: "Име",
      namePlaceholder: "напр. Еспресо",
      outlet: "Място на продажба",
      type: "Вид",
      item: "Артикул",
      extra: "Услуга",
      price: (c) => `Цена (${c})`,
      adding: "Добавяне…",
      add: "Добави",
      empty: "Все още няма артикули в каталога.",
      active: "Активен",
      save: "Запази",
      delete: "Изтрий",
    },
  },
};
