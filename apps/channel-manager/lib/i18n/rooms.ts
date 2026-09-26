import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Rooms & Rates — room types, rate plans and the linkage board, with their dialogs.
 * The words are RevioCRS's for the same fields (`reservation/lib/i18n/rates.ts`), so a hotel that
 * runs both reads one vocabulary for the one set of rooms they share.
 */
export interface CmRoomsStrings {
  title: string;
  subtitle: string;
  blocked: (name: string, kind: "room" | "plan") => [string, string, string];
  footer: string;
  inactive: string;
  active: string;
  inactivePill: string;
  rooms: {
    title: string;
    count: (n: number) => string;
    cols: { name: string; code: string; kind: string; inventory: string; max: string; plans: string; status: string };
    empty: string;
    deleteNote: string;
  };
  unitKinds: Record<"room" | "bed" | "apartment", string>;
  plans: {
    title: string;
    count: (n: number) => string;
    cols: { name: string; type: string; pricing: string; tags: string };
    derivedFrom: (parent: string) => string;
    parent: string;
    rooms: (n: number) => string;
    logic: Record<"manual" | "derived", string>;
    manualEntry: string;
    minStay: (n: number) => string;
    maxStay: (n: number) => string;
    bookAtLeast: (n: number) => string;
    bookAtMost: (n: number) => string;
    deleteNote: string;
  };
  linkageSection: { title: string; count: string };
  roomForm: {
    edit: string; add: string; editTitle: (n: string) => string; addTitle: string;
    name: string; namePlaceholder: string; code: string; codeHint: string;
    unitKind: string; total: string; totalHint: string; maxGuests: string;
    description: string; optional: string; active: string; create: string;
  };
  planForm: {
    edit: string; add: string; editTitle: (n: string) => string; addTitle: string;
    name: string; namePlaceholder: string; code: string;
    tags: string; tagsHint: string; tagsPlaceholder: string;
    restrictions: string;
    minStay: string; maxStay: string; allDates: string;
    advMin: string; advMinHint: string; advMax: string; advMaxHint: string;
    active: string; create: string;
  };
  linkage: {
    pricing: string; manual: string; derived: string; parent: string; derivedSuffix: string;
    direction: string; decrease: string; increase: string; by: string; percent: string; fixed: string;
    value: string; rounding: string;
    roundings: Record<"none" | "end_99" | "nearest_minor_1" | "nearest_minor_50", string>;
    manualNote: string; liveNote: string; unlink: string; saveLinkage: string;
    title: (plan: string) => string; failed: string;
    manualBadge: string; otaOnly: string; otaOnlyTitle: string; edit: string;
    noRoots: string;
    helpLead: string; helpTail: string;
  };
  save: { cancel: string; saving: string; saveChanges: string };
}

export const rooms: Translations<CmRoomsStrings> = {
  en: {
    title: "Rooms & Rates",
    subtitle: "What you sell — your room types, your rate plans, and how their prices are linked",
    blocked: (n, k) => [`“${n}” is mapped to a channel and can’t be deleted — remove its ${k === "room" ? "room-type" : "rate-plan"} mapping in `, "Mapping", " first, then delete it here."],
    footer: "Every change is recorded in the Audit Log and pushed to your connected channels — follow it in the Sync Center.",
    inactive: "inactive",
    active: "Active",
    inactivePill: "Inactive",
    rooms: {
      title: "Room Types",
      count: (n) => `${n} types`,
      cols: { name: "Room Type", code: "Code", kind: "Kind", inventory: "Inv.", max: "Max", plans: "Rate plans", status: "Status" },
      empty: "No room types yet. Add the rooms you sell — a Double, a Suite — and how many of each you have. Everything else on this screen builds on them.",
      deleteNote: "If it has reservations it is deactivated instead.",
    },
    unitKinds: { room: "Room", bed: "Bed (hostel)", apartment: "Apartment" },
    plans: {
      title: "Rate Plans",
      count: (n) => `${n} plans`,
      cols: { name: "Rate Plan", type: "Type", pricing: "Pricing", tags: "Tags" },
      derivedFrom: (p) => `Derived from ${p}`,
      parent: "parent",
      rooms: (n) => `${n} rooms`,
      logic: { manual: "manual", derived: "derived" },
      manualEntry: "Manual entry",
      minStay: (n) => `min ${n}n`,
      maxStay: (n) => `max ${n}n`,
      bookAtLeast: (n) => `book ≥${n}d ahead`,
      bookAtMost: (n) => `book ≤${n}d ahead`,
      deleteNote: "Parents of derived rates are deactivated instead.",
    },
    linkageSection: { title: "Rate Plan Linkage", count: "derived-pricing chains" },
    roomForm: {
      edit: "Edit room type", add: "Add Room Type", editTitle: (n) => `Edit ${n}`, addTitle: "Add Room Type",
      name: "Name", namePlaceholder: "Deluxe Double Room", code: "Code", codeHint: "Short internal reference",
      unitKind: "Unit kind", total: "Total Rooms", totalHint: "Physical count (safety-net)", maxGuests: "Max guests",
      description: "Description", optional: "Optional", active: "Active (sellable)", create: "Create room type",
    },
    planForm: {
      edit: "Edit rate plan", add: "Add Rate Plan", editTitle: (n) => `Edit ${n}`, addTitle: "Add Rate Plan",
      name: "Name", namePlaceholder: "Non Refundable", code: "Code",
      tags: "Tags", tagsHint: "Comma-separated, e.g. breakfast, non-refundable", tagsPlaceholder: "breakfast, BB",
      restrictions: "Stay & advance-purchase restrictions",
      minStay: "Minimum stay (nights)", maxStay: "Maximum stay (nights)", allDates: "Applies to all dates",
      advMin: "Advance purchase — min days", advMinHint: "Auto-closes the next N days (rolling)",
      advMax: "Advance purchase — max days", advMaxHint: "Auto-closes beyond N days (rolling)",
      active: "Active", create: "Create rate plan",
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
      manualBadge: "manual",
      otaOnly: "OTA/corp",
      otaOnlyTitle: "Not bookable on the direct channel",
      edit: "Edit linkage",
      noRoots: "Add a manual rate plan first — derived plans hang off it.",
      helpLead: "Click the ",
      helpTail: " on any rate plan to change its parent or offset, or to switch it between manual and derived. Loops and over-deep chains are rejected; a derived rate always traces back to a manual base rate.",
    },
    save: { cancel: "Cancel", saving: "Saving…", saveChanges: "Save changes" },
  },
  bg: {
    title: "Стаи и цени",
    subtitle: "Какво продавате — типовете стаи, ценовите планове и как са свързани цените им",
    blocked: (n: string, k: "room" | "plan"): [string, string, string] => [`„${n}“ е свързан с канал и не може да бъде изтрит — първо премахнете връзката на ${k === "room" ? "типа стая" : "ценовия план"} в `, "Съответствия", ", после го изтрийте тук."],
    footer: "Всяка промяна се записва в журнала и се изпраща към свързаните канали — следете я в „Синхронизация“.",
    inactive: "неактивен",
    active: "Активен",
    inactivePill: "Неактивен",
    rooms: {
      title: "Типове стаи",
      count: (n) => `${n} ${n === 1 ? "тип" : "типа"}`,
      cols: { name: "Тип стая", code: "Код", kind: "Вид", inventory: "Брой", max: "Макс.", plans: "Ценови планове", status: "Статус" },
      empty: "Все още няма типове стаи. Добавете стаите, които продавате — двойна, апартамент — и колко имате от всяка. Всичко останало на този екран се гради върху тях.",
      deleteNote: "Ако има резервации, вместо това се деактивира.",
    },
    unitKinds: { room: "Стая", bed: "Легло (хостел)", apartment: "Апартамент" },
    plans: {
      title: "Ценови планове",
      count: (n) => `${n} ${n === 1 ? "план" : "плана"}`,
      cols: { name: "Ценови план", type: "Вид", pricing: "Цена", tags: "Етикети" },
      derivedFrom: (p) => `Производен от ${p}`,
      parent: "основния план",
      rooms: (n) => `${n} ${n === 1 ? "стая" : "стаи"}`,
      logic: { manual: "ръчен", derived: "производен" },
      manualEntry: "Въвежда се на ръка",
      minStay: (n) => `мин. ${n} нощ.`,
      maxStay: (n) => `макс. ${n} нощ.`,
      bookAtLeast: (n) => `резервация ≥${n} дни предв.`,
      bookAtMost: (n) => `резервация ≤${n} дни предв.`,
      deleteNote: "Основните планове на производни цени се деактивират вместо това.",
    },
    linkageSection: { title: "Връзки между ценовите планове", count: "вериги от производни цени" },
    roomForm: {
      edit: "Редактирай типа стая", add: "Добави тип стая", editTitle: (n) => `Редактиране на ${n}`, addTitle: "Нов тип стая",
      name: "Име", namePlaceholder: "Делукс двойна стая", code: "Код", codeHint: "Кратко вътрешно означение",
      unitKind: "Вид", total: "Общ брой стаи", totalHint: "Физически брой (горна граница)", maxGuests: "Макс. гости",
      description: "Описание", optional: "По желание", active: "Активен (продава се)", create: "Създай тип стая",
    },
    planForm: {
      edit: "Редактирай ценовия план", add: "Добави ценови план", editTitle: (n) => `Редактиране на ${n}`, addTitle: "Нов ценови план",
      name: "Име", namePlaceholder: "Невъзстановима", code: "Код",
      tags: "Етикети", tagsHint: "Разделени със запетая, напр. закуска, невъзстановима", tagsPlaceholder: "закуска, BB",
      restrictions: "Престой и предварителна резервация",
      minStay: "Минимален престой (нощувки)", maxStay: "Максимален престой (нощувки)", allDates: "Важи за всички дати",
      advMin: "Резервация поне (дни предварително)", advMinHint: "Затваря следващите N дни (плъзгащо)",
      advMax: "Резервация най-много (дни предварително)", advMaxHint: "Затваря след N дни напред (плъзгащо)",
      active: "Активен", create: "Създай ценови план",
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
      manualBadge: "ръчен",
      otaOnly: "OTA/корп.",
      otaOnlyTitle: "Не може да се резервира директно",
      edit: "Промени връзката",
      noRoots: "Първо добавете ръчен ценови план — производните планове се изчисляват от него.",
      helpLead: "Натиснете ",
      helpTail: " до всеки ценови план, за да смените основния му план или разликата, или да го превключите между ръчен и производен. Кръгове и твърде дълги вериги не се допускат; производната цена винаги идва от ръчна основна цена.",
    },
    save: { cancel: "Отказ", saving: "Запазване…", saveChanges: "Запази промените" },
  },
};
