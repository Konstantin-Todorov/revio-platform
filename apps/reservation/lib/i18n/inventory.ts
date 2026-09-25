import type { Translations } from "@revio/ui/i18n";

/**
 * The Inventory Calendar and the inventory periods it subtracts — the grid a revenue manager keeps
 * open all day.
 *
 * The row names follow the waterfall and are the words the legend uses for the same numbers: one
 * name for one fact (BUG-017). "Извън експлоатация" is RevioPMS's word for out of order — a hotel
 * that runs both reads it the same in both. CTA and CTD stay as the industry and every extranet
 * write them, like ADR; the hover says what they mean.
 */
export interface InventoryStrings {
  title: string;
  subtitle: (property: string) => string;
  /** Short month names for the column heads — Intl's `bg` short month is "09", not a word. */
  monthsShort: string[];
  earlier: string;
  later: string;
  today: string;
  managePeriods: string;
  rows: Record<"physical" | "outOfOrder" | "closed" | "available" | "confirmed" | "remaining", string>;
  restrictionsRow: string;
  filterRooms: string;
  filterRates: string;
  allRooms: string;
  allRatePlans: string;
  selected: (n: number) => string;
  clear: string;
  apply: string;
  expandAll: string;
  collapseAll: string;
  units: (n: number, kind: "bed" | "room") => string;
  bulkEdit: string;
  bulkEditTitle: (roomType: string) => string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
  manualOverride: string;
  derivedFrom: (parent: string, offset: string) => string;
  /** A derived plan's name in the Rates filter. */
  derivedName: (name: string) => string;
  parentFallback: string;
  thisPlan: string;
  /** Why a price is shown lighter — by `RateSource`. */
  rateSource: {
    default: (plan: string) => string;
    derived: (parent: string) => string;
    none: (plan: string) => string;
  };
  clickToChange: string;
  chips: {
    stop: string; stopTitle: string;
    min: (n: number) => string; minTitle: (n: number) => string;
    cta: string; ctaTitle: string;
    ctd: string; ctdTitle: string;
    noneTitle: string;
  };
  legend: {
    waterfall: string;
    overrideMark: string;
    remaining: string;
    rate: string;
    restrictions: string;
    stop: string;
    cta: string;
    ctd: string;
  };
  occupancy: {
    label: (n: number) => string;
    heading: string;
    guests: (n: number) => string;
  };
  period: {
    add: string;
    title: string;
    roomType: string;
    kind: string;
    kindHint: string;
    outOfOrder: string;
    closure: string;
    from: string;
    to: string;
    units: string;
    unitsHint: (max: number) => string;
    note: string;
    notePlaceholder: string;
    cancel: string;
    saving: string;
  };
}

export const inventory: Translations<InventoryStrings> = {
  en: {
    title: "Inventory Calendar",
    subtitle: (p) => `${p} · availability, rates and restrictions`,
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    earlier: "Earlier",
    later: "Later",
    today: "Today",
    managePeriods: "Manage periods",
    rows: {
      physical: "Physical", outOfOrder: "Out of order", closed: "Closed",
      available: "Allocation", confirmed: "Sold", remaining: "Bookable",
    },
    restrictionsRow: "Restrictions",
    filterRooms: "Rooms",
    filterRates: "Rates",
    allRooms: "All",
    allRatePlans: "All rate plans",
    selected: (n) => `${n} selected`,
    clear: "Clear",
    apply: "Apply",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    units: (n, kind) => `${n} ${kind === "bed" ? "beds" : "rooms"}`,
    bulkEdit: "Bulk edit",
    bulkEditTitle: (rt) => `Bulk edit · ${rt}`,
    emptyTitle: "No room types yet",
    emptyBody: "The calendar shows availability and rates for each room type you sell. Add your first room type and it appears here.",
    emptyAction: "Go to Rooms & Rates",
    manualOverride: "Manual rooms-to-sell override (set in RevioLink)",
    derivedFrom: (parent, offset) => `Derived from ${parent} · ${offset}`,
    derivedName: (name) => `${name} (derived)`,
    parentFallback: "its parent plan",
    thisPlan: "This plan",
    rateSource: {
      default: (plan) => `No price set for this night — it sells at ${plan}'s default rate, and that is what the channels are sent. Type a price to override it.`,
      derived: (parent) => `Follows ${parent} — change the parent's price and this moves with it.`,
      none: (plan) => `${plan} has no price for this night and no default rate, so it cannot be sold. Set a price, or a default rate in Rooms & Rates.`,
    },
    clickToChange: "Click to change this night's price",
    chips: {
      stop: "closed", stopTitle: "Stop sell — not bookable",
      min: (n) => `min ${n}`, minTitle: (n) => `Minimum stay ${n} nights`,
      cta: "cta", ctaTitle: "Closed to arrival — a stay may not begin on this date",
      ctd: "ctd", ctdTitle: "Closed to departure — a stay may not end on this date",
      noneTitle: "No restrictions",
    },
    legend: {
      waterfall: "Allocation = physical − out of order − closed",
      overrideMark: "marks a manual rooms-to-sell override from RevioLink",
      remaining: "Bookable = allocation − holds − sold. Negative bookable = overbooked.",
      rate: "Rate = the plan's price for the night, click to edit.",
      restrictions: "Restrictions resolve date-scoped edit (calendar/bulk, most recent wins) → rule → plan → property default",
      stop: "stop",
      cta: "CTA",
      ctd: "CTD",
    },
    occupancy: {
      label: (n) => `Prices for ${n} guest counts`,
      heading: "Per guest count",
      guests: (n) => `${n}p`,
    },
    period: {
      add: "Add period",
      title: "Add inventory period",
      roomType: "Room type",
      kind: "Kind",
      kindHint: "Out of order = maintenance. Closure = the units aren't sellable (seasonal etc.).",
      outOfOrder: "Out of order",
      closure: "Closure",
      from: "From",
      to: "To (inclusive)",
      units: "Units affected",
      unitsHint: (max) => `1–${max} for this room type.`,
      note: "Note (optional)",
      notePlaceholder: "e.g. Bathroom renovation rooms 204–205",
      cancel: "Cancel",
      saving: "Saving…",
    },
  },
  bg: {
    title: "Календар на наличността",
    subtitle: (p) => `${p} · наличност, цени и ограничения`,
    monthsShort: ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"],
    earlier: "По-рано",
    later: "По-късно",
    today: "Днес",
    managePeriods: "Периоди",
    rows: {
      physical: "Физически", outOfOrder: "Извън експлоатация", closed: "Затворени",
      available: "Капацитет", confirmed: "Продадени", remaining: "Налични",
    },
    restrictionsRow: "Ограничения",
    filterRooms: "Стаи",
    filterRates: "Цени",
    allRooms: "Всички",
    allRatePlans: "Всички ценови планове",
    selected: (n) => `${n} избрани`,
    clear: "Изчисти",
    apply: "Приложи",
    expandAll: "Разгъни всички",
    collapseAll: "Свий всички",
    units: (n, kind) => kind === "bed" ? `${n} ${n === 1 ? "легло" : "легла"}` : `${n} ${n === 1 ? "стая" : "стаи"}`,
    bulkEdit: "Масова промяна",
    bulkEditTitle: (rt) => `Масова промяна · ${rt}`,
    emptyTitle: "Все още няма типове стаи",
    emptyBody: "Календарът показва наличността и цените за всеки тип стая, който продавате. Добавете първия тип стая и той ще се появи тук.",
    emptyAction: "Към „Стаи и цени“",
    manualOverride: "Ръчно зададен брой стаи за продажба (от RevioLink)",
    derivedFrom: (parent, offset) => `Производен от ${parent} · ${offset}`,
    derivedName: (name) => `${name} (производен)`,
    parentFallback: "основния си план",
    thisPlan: "Този план",
    rateSource: {
      default: (plan) => `За тази нощ няма зададена цена — продава се на цената по подразбиране на „${plan}“ и тя се изпраща към каналите. Въведете цена, за да я замените.`,
      derived: (parent) => `Следва „${parent}“ — променете цената на основния план и тази се променя с нея.`,
      none: (plan) => `„${plan}“ няма цена за тази нощ и няма цена по подразбиране, затова не може да се продава. Задайте цена тук или цена по подразбиране в „Стаи и цени“.`,
    },
    clickToChange: "Натиснете, за да промените цената за нощта",
    chips: {
      stop: "стоп", stopTitle: "Стоп продажби — не може да се резервира",
      min: (n) => `мин ${n}`, minTitle: (n) => `Минимален престой ${n} ${n === 1 ? "нощувка" : "нощувки"}`,
      cta: "cta", ctaTitle: "Затворено за пристигане (CTA) — престой не може да започва на тази дата",
      ctd: "ctd", ctdTitle: "Затворено за напускане (CTD) — престой не може да завършва на тази дата",
      noneTitle: "Без ограничения",
    },
    legend: {
      waterfall: "Капацитет = физически − извън експлоатация − затворени",
      overrideMark: "отбелязва ръчно зададен брой стаи за продажба от RevioLink",
      remaining: "Налични = капацитет − задържани − продадени. Отрицателна наличност = свръхрезервация.",
      rate: "Цена = цената на плана за нощта; натиснете, за да я промените.",
      restrictions: "Ограниченията се определят в този ред: промяна за дати (календар/масова, последната важи) → правило → план → настройка на обекта",
      stop: "стоп",
      cta: "CTA (без пристигане)",
      ctd: "CTD (без напускане)",
    },
    occupancy: {
      label: (n) => `Цени за ${n} варианта на брой гости`,
      heading: "По брой гости",
      guests: (n) => `${n} ${n === 1 ? "гост" : "гости"}`,
    },
    period: {
      add: "Добави период",
      title: "Нов период на наличност",
      roomType: "Тип стая",
      kind: "Вид",
      kindHint: "Извън експлоатация = ремонт или повреда. Затваряне = стаите не се продават (сезонно и др.).",
      outOfOrder: "Извън експлоатация",
      closure: "Затваряне",
      from: "От",
      to: "До (включително)",
      units: "Засегнати стаи",
      unitsHint: (max) => `От 1 до ${max} за този тип стая.`,
      note: "Бележка (по желание)",
      notePlaceholder: "напр. Ремонт на баните в стаи 204–205",
      cancel: "Отказ",
      saving: "Запазване…",
    },
  },
};
