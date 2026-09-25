import type { Translations } from "@revio/ui/i18n";
import { BED_SETUPS, ROOM_AMENITIES, ROOM_AMENITY_GROUPS } from "@revio/core";

/**
 * Rooms & Rates — the room types and rate plans a hotel sells, shared with RevioLink.
 *
 * Amenities, their groups and bed setups are defined once in `@revio/core` (RevioDirect reads them
 * too, and Channex takes their ids). The English here is BUILT from core, so it cannot drift; the
 * Bulgarian is keyed by the same keys, so a new amenity in core is a missing key in the coverage test
 * rather than an English chip on a Bulgarian screen.
 *
 * ценови план, производен (derived), основен план (parent) — the glossary in `@revio/ui/i18n`.
 */
export interface RatesStrings {
  title: string;
  subtitle: (property: string) => string;
  nav: {
    rooms: string; roomsBlurb: string;
    plans: string; plansBlurb: string;
    closures: string; closuresBlurb: string;
    daily: string; dailyBlurb: string;
    bulk: string; bulkBlurb: string;
    engine: string; engineBlurb: string;
    label: string; elsewhere: string;
  };
  inactive: string;
  blocked: (name: string) => string;
  pricingModel: Record<"per_room" | "per_person", string>;
  rooms: {
    title: string;
    subtitle: string;
    empty: string;
    units: (n: number, kind: string) => string;
    sleeps: (n: number) => string;
    photos: (n: number) => string;
    guestsSee: (missing: ("photo" | "description")[]) => string;
    back: string;
    headerLine: (code: string, physical: number, sleeps: number) => string;
    tabsLabel: (name: string) => string;
    tabs: { basics: string; guest: string; photos: string; plans: string };
    deleteText: string;
    deleteNote: string;
    photosTitle: string;
    photosSubtitle: string;
    plansTitle: string;
    plansSubtitle: string;
    plansEmpty: string;
    add: string;
    addTitle: string;
    addNext: string;
    create: string;
  };
  roomForm: {
    name: string; namePlaceholder: string;
    code: string; codeHint: string;
    unitKind: string; unitKinds: Record<"room" | "apartment" | "bed", string>;
    physical: string; physicalHint: string;
    maxGuests: string;
    normally: string; normallyHint: string;
    active: string;
    description: string; descriptionHint: string; descriptionPlaceholder: string;
    size: string; sizeHint: string; sizePlaceholder: string;
    beds: string; bedsNone: string;
    amenities: string;
    basicsTitle: string; basicsSubtitle: string;
    guestTitle: string; guestSubtitle: string;
  };
  amenities: Record<string, string>;
  amenityGroups: Record<string, string>;
  bedSetups: Record<string, string>;
  save: { saved: string; saving: string; saveChanges: string; cancel: string; save: string };
  plans: {
    title: string;
    subtitle: string;
    empty: string;
    otaOnly: string;
    otaOnlyTitle: string;
    roomTypes: (n: number) => string;
    from: (parent: string) => string;
    footer: string;
    back: string;
    roomOnly: string;
    pricedFrom: (parent: string, offset: string) => string;
    tabsLabel: (name: string) => string;
    tabs: { plan: string; price: string; rooms: string };
    deleteText: string;
    deleteNote: string;
    roomsTitle: string;
    roomsSubtitle: string;
    roomsEmpty: string;
    add: string;
    addTitle: string;
    create: string;
    defaultsBox: string;
  };
  planForm: {
    name: string; namePlaceholder: string;
    code: string; codePlaceholder: string;
    tags: string; tagsHint: string; tagsPlaceholder: string;
    active: string;
    direct: string; directHint: string;
    minStay: string; maxStay: string; allDates: string;
    bookAtLeast: string; bookAtLeastHint: string;
    bookAtMost: string; bookAtMostHint: string;
    planTitle: string; planSubtitle: string;
    defaultsTitle: string; defaultsSubtitle: string;
  };
  linkage: {
    pricing: string;
    manual: string;
    derived: string;
    parent: string;
    derivedSuffix: string;
    direction: string;
    decrease: string;
    increase: string;
    by: string;
    percent: string;
    fixed: string;
    value: string;
    rounding: string;
    roundings: Record<"none" | "end_99" | "nearest_minor_1" | "nearest_minor_50", string>;
    manualNote: string;
    liveNote: string;
    unlink: string;
    saveLinkage: string;
    title: (plan: string) => string;
    failed: string;
    cardTitle: string;
    cardSubtitle: string;
    change: string;
    pricedFromLabel: string;
    itsParent: string;
    ownPrices: string;
    ownPricesTail: string;
    dependents: string;
  };
  pricing: {
    cardTitle: string;
    cardSubtitle: string;
    priceIsFor: (n: number) => string;
    follows: string;
    own: string;
    sleepsUpTo: (n: number) => string;
    title: (plan: string) => string;
    model: string;
    inherit: (model: string) => string;
    perRoom: string;
    perPerson: string;
    pricedAt: string;
    pricedAtHint: (ceiling: number) => string;
  };
  photos: {
    coverLead: string;
    coverTail: string;
    dragLead: string;
    handle: string;
    dragTail: string;
    makeCover: string;
    dragLabel: (alt: string) => string;
    thisPhoto: string;
    photoAlt: (room: string, n: number) => string;
    cover: string;
    shownFirst: string;
    describe: string;
    altLabel: (n: number) => string;
    deleteLabel: (n: number) => string;
    uploading: string;
    addMore: string;
    add: string;
    footnote: string;
  };
  closures: {
    title: string;
    subtitle: string;
    empty: string;
    cols: { roomType: string; kind: string; from: string; to: string; units: string; note: string; status: string };
    closure: string;
    outOfOrder: string;
    current: string;
    past: string;
    deleteLabel: (room: string, kind: "closure" | "out_of_order") => string;
    deleteNote: string;
  };
}

const coreLabels = <T extends { key: string; label: string }>(list: readonly T[]) =>
  Object.fromEntries(list.map((x) => [x.key, x.label])) as Record<string, string>;

export const rates: Translations<RatesStrings> = {
  en: {
    title: "Rooms & Rates",
    subtitle: (p) => `${p} · what you sell — shared with RevioLink, so you set it up once`,
    nav: {
      rooms: "Room types", roomsBlurb: "What you sell, its photos and what a guest reads",
      plans: "Rate plans", plansBlurb: "How each rate prices, and where its price comes from",
      closures: "Closures", closuresBlurb: "Rooms closed for sale, and rooms out of order",
      daily: "Daily prices", dailyBlurb: "Prices and availability per date — the Inventory Calendar",
      bulk: "Bulk changes", bulkBlurb: "Prices and restrictions across many dates at once",
      engine: "Booking Engine", engineBlurb: "Where guests see these rooms",
      label: "Rooms & Rates sections", elsewhere: "Elsewhere",
    },
    inactive: "inactive",
    blocked: (n) => `“${n}” is mapped to the channel manager and can’t be deleted — unmap it in RevioLink → Mapping first.`,
    pricingModel: { per_room: "Per room", per_person: "Per person" },
    rooms: {
      title: "Room types",
      subtitle: "The rooms you sell and how many of each exist — open one for its photos, description and prices",
      empty: "No room types yet. Add the rooms you sell — a Double, a Suite — and how many of each you have. Availability, rates and every quote build on them.",
      units: (n, kind) => `${n} ${kind === "bed" ? (n === 1 ? "bed" : "beds") : n === 1 ? "unit" : "units"}`,
      sleeps: (n) => `sleeps ${n}`,
      photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
      guestsSee: (m) => `Guests see ${m.map((x) => (x === "photo" ? "no photo" : "no description")).join(" and ")}`,
      back: "All room types",
      headerLine: (code, physical, sleeps) => `${code} · ${physical} physical · sleeps ${sleeps}`,
      tabsLabel: (n) => `${n} views`,
      tabs: { basics: "Basics", guest: "What a guest reads", photos: "Photos", plans: "Rate plans" },
      deleteText: "Delete this room type. One with reservations or physical rooms behind it is deactivated instead, so history stays intact.",
      deleteNote: "Room types with reservations or physical rooms behind them are deactivated instead, so history stays intact.",
      photosTitle: "Photos",
      photosSubtitle: "Shown to guests on your booking page, in this order",
      plansTitle: "Rate plans that sell this room",
      plansSubtitle: "Each plan's price applies to this room — open one to see how it prices",
      plansEmpty: "No rate plan sells this room yet, so no guest can book it.",
      add: "Add room type",
      addTitle: "Add room type",
      addNext: "Description, amenities and photos come next, on the room’s own page.",
      create: "Create room type",
    },
    roomForm: {
      name: "Name", namePlaceholder: "Deluxe Double Room",
      code: "Code", codeHint: "Short internal reference",
      unitKind: "Unit kind", unitKinds: { room: "Room", apartment: "Apartment", bed: "Bed (hostel)" },
      physical: "Physical count", physicalHint: "The cap & safety net",
      maxGuests: "Max guests",
      normally: "Normally sold to", normallyHint: "Guests in a typical booking — the party size a per-person price is quoted at. Blank uses the max.",
      active: "Active (sellable)",
      description: "Description", descriptionHint: "A sentence or two, in your guests' own words",
      descriptionPlaceholder: "A quiet corner room with a private balcony over the courtyard…",
      size: "Room size", sizeHint: "Square metres", sizePlaceholder: "e.g. 24",
      beds: "Beds", bedsNone: "Not specified",
      amenities: "Amenities",
      basicsTitle: "The basics",
      basicsSubtitle: "What you sell and how many of it exist — the physical count is the cap every channel sells under",
      guestTitle: "What a guest reads",
      guestSubtitle: "Shown on your booking page. All optional — a room with none of this still sells, it just says less",
    },
    amenities: coreLabels(ROOM_AMENITIES),
    amenityGroups: coreLabels(ROOM_AMENITY_GROUPS),
    bedSetups: coreLabels(BED_SETUPS),
    save: { saved: "Saved", saving: "Saving…", saveChanges: "Save changes", cancel: "Cancel", save: "Save" },
    plans: {
      title: "Rate plans",
      subtitle: "Plans priced from another one sit under it, with the difference — open a plan for everything about it",
      empty: "No rate plans yet. Add the rate you sell most — the others can be priced from it.",
      otaOnly: "OTA/corporate only",
      otaOnlyTitle: "Not bookable on your own booking page",
      roomTypes: (n) => `${n} room type${n === 1 ? "" : "s"}`,
      from: (p) => ` · from ${p}`,
      footer: "Daily prices live on the Inventory Calendar or in Bulk Rates & Availability; derived plans follow their parent automatically.",
      back: "All rate plans",
      roomOnly: "room only",
      pricedFrom: (p, o) => ` · priced from ${p} ${o}`,
      tabsLabel: (n) => `${n} views`,
      tabs: { plan: "Plan & defaults", price: "Price", rooms: "Rooms it sells" },
      deleteText: "Delete this plan. A plan mapped in RevioLink must be unmapped first; one in use is deactivated instead.",
      deleteNote: "Mapped plans must be unmapped in RevioLink first; plans in use are deactivated instead.",
      roomsTitle: "Rooms it sells",
      roomsSubtitle: "This plan's price applies to each of these rooms",
      roomsEmpty: "This plan sells no room yet.",
      add: "Add rate plan",
      addTitle: "Add rate plan",
      create: "Create rate plan",
      defaultsBox: "Stay & advance-purchase defaults",
    },
    planForm: {
      name: "Name", namePlaceholder: "Non Refundable",
      code: "Code", codePlaceholder: "NR",
      tags: "Tags", tagsHint: "Comma-separated, e.g. breakfast, non-refundable", tagsPlaceholder: "breakfast, BB",
      active: "Active",
      direct: "Sell on our own booking page",
      directHint: "Off for rates that belong to a specific partner — corporate, tour operator, an OTA-only promotion.",
      minStay: "Minimum stay (nights)", maxStay: "Maximum stay (nights)", allDates: "Applies to all dates",
      bookAtLeast: "Book at least (days ahead)", bookAtLeastHint: "Auto-closes the next N days (rolling)",
      bookAtMost: "Book at most (days ahead)", bookAtMostHint: "Auto-closes beyond N days (rolling)",
      planTitle: "The plan", planSubtitle: "Its name, and where it is sold",
      defaultsTitle: "Defaults",
      defaultsSubtitle: "Minimum stay and advance purchase, used on every date that has no rule of its own",
    },
    linkage: {
      pricing: "Pricing",
      manual: "Manual — entered by hand",
      derived: "Derived — computed from a parent",
      parent: "Derived from (parent)",
      derivedSuffix: " (derived)",
      direction: "Direction",
      decrease: "Decrease",
      increase: "Increase",
      by: "By",
      percent: "Percent %",
      fixed: "Fixed (cents)",
      value: "Value",
      rounding: "Rounding",
      roundings: { none: "None", end_99: "End in .99", nearest_minor_1: "Nearest whole", nearest_minor_50: "Nearest 0.50" },
      manualNote: "This plan will be priced by hand. Any prices you set on the calendar or in bulk apply directly to it.",
      liveNote: "Derived prices are computed live from the parent — a plan’s own manual prices are ignored while it’s derived and used again if you switch it back to manual. Nothing is overwritten.",
      unlink: "Unlink",
      saveLinkage: "Save linkage",
      title: (p) => `Linkage · ${p}`,
      failed: "Could not save the linkage.",
      cardTitle: "Where its price comes from",
      cardSubtitle: "Its own prices, or another plan's with an offset — a derived price follows its parent on every date",
      change: "Change",
      pricedFromLabel: "Priced from",
      itsParent: "its parent",
      ownPrices: "Its own prices",
      ownPricesTail: " — set on the Inventory Calendar or in Bulk Rates & Availability.",
      dependents: "Priced from this plan",
    },
    pricing: {
      cardTitle: "How it prices",
      cardSubtitle: "Per room, or per person — a half-board rate can price per guest beside a room-only rate priced per room",
      priceIsFor: (n) => `· the price is for ${n}`,
      follows: "Follows the property setting.",
      own: "Set for this plan only.",
      sleepsUpTo: (n) => ` Its rooms sleep up to ${n}.`,
      title: (p) => `How “${p}” prices`,
      model: "Pricing model",
      inherit: (m) => `Follow the property — ${m}`,
      perRoom: "Per room — one price whoever stays",
      perPerson: "Per person — the price follows the party size",
      pricedAt: "Priced at",
      pricedAtHint: (c) => `The party size the headline price is for. Every other size is worked out from it. This plan's rooms sleep up to ${c}.`,
    },
    photos: {
      coverLead: "The first photo is the cover",
      coverTail: " — the one guests see first, on the room’s card. ",
      dragLead: "Drag a photo by its ",
      handle: "⠿ handle",
      dragTail: " to change the order, or press ",
      makeCover: "Make cover",
      dragLabel: (alt) => `Drag to reorder ${alt}`,
      thisPhoto: "this photo",
      photoAlt: (r, n) => `${r} photo ${n}`,
      cover: "Cover photo",
      shownFirst: "Shown first",
      describe: "Describe this photo",
      altLabel: (n) => `Alt text for photo ${n}`,
      deleteLabel: (n) => `Delete photo ${n}`,
      uploading: "Uploading…",
      addMore: "Add more photos",
      add: "Add photos",
      footnote: "Large images are resized automatically, so upload straight from your phone. No photos is fine: the room still shows with its name, size and what’s included.",
    },
    closures: {
      title: "Out-of-order & closure periods",
      subtitle: "Close rooms for sale here. Rooms taken out of order come from RevioPMS.",
      empty: "Nothing closed — add a closure when rooms go under maintenance or a wing shuts for the season.",
      cols: { roomType: "Room type", kind: "Kind", from: "From", to: "To", units: "Units", note: "Note", status: "Status" },
      closure: "closure",
      outOfOrder: "out of order",
      current: "current",
      past: "past",
      deleteLabel: (r, k) => `${r} ${k === "closure" ? "closure" : "out-of-order"} period`,
      deleteNote: "Availability for these dates restores immediately.",
    },
  },
  bg: {
    title: "Стаи и цени",
    subtitle: (p) => `${p} · какво продавате — общо с RevioLink, настройвате го веднъж`,
    nav: {
      rooms: "Типове стаи", roomsBlurb: "Какво продавате, снимките и какво четат гостите",
      plans: "Ценови планове", plansBlurb: "Как се формира всяка цена и откъде идва",
      closures: "Затваряния", closuresBlurb: "Стаи, спрени от продажба, и стаи извън експлоатация",
      daily: "Цени по дни", dailyBlurb: "Цени и наличност по дати — Календарът на наличността",
      bulk: "Масови промени", bulkBlurb: "Цени и ограничения за много дати наведнъж",
      engine: "Директни резервации", engineBlurb: "Къде гостите виждат тези стаи",
      label: "Раздели на „Стаи и цени“", elsewhere: "Другаде",
    },
    inactive: "неактивен",
    blocked: (n) => `„${n}“ е свързан в каналния мениджър и не може да бъде изтрит — първо премахнете връзката в RevioLink → Съответствия.`,
    pricingModel: { per_room: "На стая", per_person: "На човек" },
    rooms: {
      title: "Типове стаи",
      subtitle: "Стаите, които продавате, и колко са от всеки тип — отворете една за снимки, описание и цени",
      empty: "Все още няма типове стаи. Добавете стаите, които продавате — двойна, апартамент — и колко имате от всяка. Наличността, цените и всяка оферта се градят върху тях.",
      units: (n, kind) => kind === "bed" ? `${n} ${n === 1 ? "легло" : "легла"}` : `${n} ${n === 1 ? "бр." : "бр."}`,
      sleeps: (n) => `до ${n} ${n === 1 ? "гост" : "гости"}`,
      photos: (n) => `${n} ${n === 1 ? "снимка" : "снимки"}`,
      guestsSee: (m) => `Гостите не виждат ${m.map((x) => (x === "photo" ? "снимка" : "описание")).join(" и ")}`,
      back: "Всички типове стаи",
      headerLine: (code, physical, sleeps) => `${code} · ${physical} физически · до ${sleeps} ${sleeps === 1 ? "гост" : "гости"}`,
      tabsLabel: (n) => `Изгледи на ${n}`,
      tabs: { basics: "Основни", guest: "Какво четат гостите", photos: "Снимки", plans: "Ценови планове" },
      deleteText: "Изтриване на този тип стая. Ако зад него има резервации или физически стаи, той се деактивира, за да се запази историята.",
      deleteNote: "Типовете стаи с резервации или физически стаи зад тях се деактивират, за да се запази историята.",
      photosTitle: "Снимки",
      photosSubtitle: "Показват се на гостите на страницата Ви за резервации, в този ред",
      plansTitle: "Ценови планове, които продават стаята",
      plansSubtitle: "Цената на всеки план важи за тази стая — отворете план, за да видите как се формира",
      plansEmpty: "Никой ценови план още не продава тази стая, затова никой гост не може да я резервира.",
      add: "Добави тип стая",
      addTitle: "Нов тип стая",
      addNext: "Описанието, удобствата и снимките се добавят след това, на страницата на стаята.",
      create: "Създай тип стая",
    },
    roomForm: {
      name: "Име", namePlaceholder: "Делукс двойна стая",
      code: "Код", codeHint: "Кратко вътрешно означение",
      unitKind: "Вид", unitKinds: { room: "Стая", apartment: "Апартамент", bed: "Легло (хостел)" },
      physical: "Физически брой", physicalHint: "Горната граница за продажба",
      maxGuests: "Макс. гости",
      normally: "Обичайно настаняване", normallyHint: "Брой гости в типична резервация — за него се показва цената на човек. Празно = максимумът.",
      active: "Активен (продава се)",
      description: "Описание", descriptionHint: "Едно-две изречения, с думите на гостите Ви",
      descriptionPlaceholder: "Тиха ъглова стая със собствен балкон към вътрешния двор…",
      size: "Площ", sizeHint: "Квадратни метри", sizePlaceholder: "напр. 24",
      beds: "Легла", bedsNone: "Не е посочено",
      amenities: "Удобства",
      basicsTitle: "Основни",
      basicsSubtitle: "Какво продавате и колко броя има — физическият брой е горната граница за всеки канал",
      guestTitle: "Какво четат гостите",
      guestSubtitle: "Показва се на страницата Ви за резервации. Всичко е по желание — стая без него пак се продава, просто казва по-малко",
    },
    amenities: {
      air_conditioning: "Климатик", heating: "Отопление", wifi: "Безплатен WiFi", tv: "Телевизор",
      safe: "Сейф в стаята", desk: "Бюро", soundproofing: "Шумоизолация", iron: "Ютия и дъска",
      private_bathroom: "Собствена баня", shower: "Душ", bathtub: "Вана", hairdryer: "Сешоар",
      toiletries: "Безплатни тоалетни принадлежности", bathrobes: "Халати и чехли",
      kitchenette: "Кухненски бокс", fridge: "Хладилник", minibar: "Минибар", coffee_tea: "Кафе и чай",
      microwave: "Микровълнова фурна", dishwasher: "Съдомиялна",
      balcony: "Балкон", terrace: "Тераса", sea_view: "Изглед към морето", mountain_view: "Изглед към планината",
      city_view: "Изглед към града", garden_view: "Изглед към градината", private_pool: "Собствен басейн",
      cot_available: "Бебешка кошара при заявка", extra_bed_available: "Възможно допълнително легло",
      connecting_rooms: "Възможни свързани стаи", family_friendly: "Подходяща за деца",
      smoking_allowed: "Пушенето е разрешено", pets_allowed: "Домашни любимци са разрешени",
      accessible: "Достъп без стъпала", ground_floor: "Партер", lift_access: "Достъп с асансьор",
    },
    amenityGroups: {
      comfort: "Комфорт", bathroom: "Баня", kitchen: "Кухня и хранене", view: "Изглед и пространство",
      family: "Семейство", policy: "Добре е да знаете",
    },
    bedSetups: {
      single: "1 единично легло", twin: "2 единични легла", double: "1 двойно легло",
      queen: "1 голямо двойно легло (queen)", king: "1 много голямо двойно легло (king)",
      double_single: "1 двойно + 1 единично", two_double: "2 двойни легла", sofa_bed: "1 разтегателен диван",
      bunk: "Двуетажни легла", dorm_bed: "Легло в обща стая",
    },
    save: { saved: "Запазено", saving: "Запазване…", saveChanges: "Запази промените", cancel: "Отказ", save: "Запази" },
    plans: {
      title: "Ценови планове",
      subtitle: "Плановете, чиято цена идва от друг план, стоят под него, с разликата — отворете план за всичко за него",
      empty: "Все още няма ценови планове. Добавете цената, която продавате най-често — другите могат да се изчисляват от нея.",
      otaOnly: "Само OTA/корпоративен",
      otaOnlyTitle: "Не може да се резервира на Вашата страница за резервации",
      roomTypes: (n) => `${n} ${n === 1 ? "тип стая" : "типа стаи"}`,
      from: (p) => ` · от ${p}`,
      footer: "Цените по дни се задават в Календара на наличността или в Масови промени; производните планове следват основния си план автоматично.",
      back: "Всички ценови планове",
      roomOnly: "само нощувка",
      pricedFrom: (p, o) => ` · цена от ${p} ${o}`,
      tabsLabel: (n) => `Изгледи на ${n}`,
      tabs: { plan: "План и настройки", price: "Цена", rooms: "Стаи, които продава" },
      deleteText: "Изтриване на този план. План, свързан в RevioLink, трябва първо да бъде откачен; план в употреба се деактивира.",
      deleteNote: "Свързаните планове първо се откачат в RevioLink; плановете в употреба се деактивират.",
      roomsTitle: "Стаи, които продава",
      roomsSubtitle: "Цената на този план важи за всяка от тези стаи",
      roomsEmpty: "Този план още не продава нито една стая.",
      add: "Добави ценови план",
      addTitle: "Нов ценови план",
      create: "Създай ценови план",
      defaultsBox: "Престой и предварителна резервация по подразбиране",
    },
    planForm: {
      name: "Име", namePlaceholder: "Невъзстановима",
      code: "Код", codePlaceholder: "NR",
      tags: "Етикети", tagsHint: "Разделени със запетая, напр. закуска, невъзстановима", tagsPlaceholder: "закуска, BB",
      active: "Активен",
      direct: "Продава се на нашата страница за резервации",
      directHint: "Изключете за цени на конкретен партньор — корпоративни, туроператор, промоция само за OTA.",
      minStay: "Минимален престой (нощувки)", maxStay: "Максимален престой (нощувки)", allDates: "Важи за всички дати",
      bookAtLeast: "Резервация поне (дни предварително)", bookAtLeastHint: "Затваря следващите N дни (плъзгащо)",
      bookAtMost: "Резервация най-много (дни предварително)", bookAtMostHint: "Затваря след N дни напред (плъзгащо)",
      planTitle: "Планът", planSubtitle: "Името му и къде се продава",
      defaultsTitle: "По подразбиране",
      defaultsSubtitle: "Минимален престой и предварителна резервация за всяка дата, която няма собствено правило",
    },
    linkage: {
      pricing: "Ценообразуване",
      manual: "Ръчно — въвежда се на ръка",
      derived: "Производно — изчислява се от основен план",
      parent: "Производен от (основен план)",
      derivedSuffix: " (производен)",
      direction: "Посока",
      decrease: "Намаление",
      increase: "Увеличение",
      by: "С",
      percent: "Процент %",
      fixed: "Фиксирано (центове)",
      value: "Стойност",
      rounding: "Закръгляне",
      roundings: { none: "Без", end_99: "Завършва на ,99", nearest_minor_1: "До цяло число", nearest_minor_50: "До 0,50" },
      manualNote: "Този план ще се цени на ръка. Цените, които задавате в календара или масово, важат директно за него.",
      liveNote: "Производните цени се изчисляват в момента от основния план — собствените ръчни цени на плана не се ползват, докато е производен, и важат отново, ако го върнете на ръчно. Нищо не се презаписва.",
      unlink: "Откачи",
      saveLinkage: "Запази връзката",
      title: (p) => `Връзка · ${p}`,
      failed: "Връзката не можа да бъде запазена.",
      cardTitle: "Откъде идва цената",
      cardSubtitle: "Собствени цени или цената на друг план с разлика — производната цена следва основния план на всяка дата",
      change: "Промени",
      pricedFromLabel: "Цена от",
      itsParent: "основния план",
      ownPrices: "Собствени цени",
      ownPricesTail: " — задават се в Календара на наличността или в Масови промени.",
      dependents: "Изчисляват се от този план",
    },
    pricing: {
      cardTitle: "Как се цени",
      cardSubtitle: "На стая или на човек — полупансион може да се цени на гост до цена „само нощувка“ на стая",
      priceIsFor: (n) => `· цената е за ${n} ${n === 1 ? "гост" : "гости"}`,
      follows: "Следва настройката на обекта.",
      own: "Зададено само за този план.",
      sleepsUpTo: (n) => ` Стаите му са за до ${n} ${n === 1 ? "гост" : "гости"}.`,
      title: (p) => `Как се цени „${p}“`,
      model: "Модел на ценообразуване",
      inherit: (m) => `Като обекта — ${m}`,
      perRoom: "На стая — една цена, независимо колко гости",
      perPerson: "На човек — цената зависи от броя гости",
      pricedAt: "Цената е за",
      pricedAtHint: (c) => `Броят гости, за които е основната цена. Всички други се изчисляват от нея. Стаите на този план са за до ${c} ${c === 1 ? "гост" : "гости"}.`,
    },
    photos: {
      coverLead: "Първата снимка е корица",
      coverTail: " — тя се вижда първа, на картата на стаята. ",
      dragLead: "Плъзнете снимка за ",
      handle: "⠿ дръжката",
      dragTail: ", за да смените реда, или натиснете ",
      makeCover: "Направи корица",
      dragLabel: (alt) => `Плъзнете, за да преместите ${alt}`,
      thisPhoto: "тази снимка",
      photoAlt: (r, n) => `${r} — снимка ${n}`,
      cover: "Корица",
      shownFirst: "Показва се първа",
      describe: "Опишете снимката",
      altLabel: (n) => `Описание на снимка ${n}`,
      deleteLabel: (n) => `Изтрий снимка ${n}`,
      uploading: "Качване…",
      addMore: "Добави още снимки",
      add: "Добави снимки",
      footnote: "Големите снимки се оразмеряват автоматично, така че качвайте направо от телефона. Може и без снимки: стаята пак се показва с име, площ и какво включва.",
    },
    closures: {
      title: "Периоди извън експлоатация и затваряния",
      subtitle: "Тук спирате стаи от продажба. Стаите извън експлоатация идват от RevioPMS.",
      empty: "Нищо не е затворено — добавете затваряне, когато стаи са в ремонт или крило се затваря за сезона.",
      cols: { roomType: "Тип стая", kind: "Вид", from: "От", to: "До", units: "Брой", note: "Бележка", status: "Статус" },
      closure: "затваряне",
      outOfOrder: "извън експлоатация",
      current: "текущ",
      past: "минал",
      deleteLabel: (r, k) => `период ${k === "closure" ? "на затваряне" : "извън експлоатация"} за ${r}`,
      deleteNote: "Наличността за тези дати се възстановява веднага.",
    },
  },
};
