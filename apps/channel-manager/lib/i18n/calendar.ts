import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Calendar — the grid and month views, the rows `getCalendarBoard` builds, and the demo
 * booking simulator.
 *
 * Row names are RevioCRS's words for the same numbers (`reservation/lib/i18n/inventory.ts`):
 * „Капацитет“ for allocation, „Налични“ for bookable — one name for one fact across both products.
 * CTA/CTD stay as the industry writes them, like on the CRS calendar. `rateSource` mirrors core's
 * `rateSourceNote`; the drift test holds the English to it.
 */
export interface CmCalendarStrings {
  title: string;
  subtitle: (property: string) => string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
  grid: string;
  month: string;
  days: (n: number) => string;
  prevWindow: string;
  nextWindow: string;
  today: string;
  prevMonth: string;
  nextMonth: string;
  thisMonth: string;
  go: string;
  endHint: string;
  months: string[];
  weekdays: string[];
  monthsShort: string[];
  rooms: string;
  all: string;
  rates: string;
  ratesDefault: string;
  display: string;
  displayDefault: string;
  legend: { stop: string; cta: string; ctd: string; weekend: string };
  limitations: string;
  ignores: (channel: string, what: string) => string;
  noMatch: string;
  units: (n: number, kind: "bed" | "room") => string;
  gridFootnote: string;
  monthFootnote: string;
  minStayBadge: string;
  rows: { inventory: string; sold: string; bookable: string; minlos: string; cta: string; ctd: string; stopsell: string };
  rowGroups: Record<"sold" | "minlos" | "cta" | "ctd" | "stopsell", string>;
  capLabels: Record<string, string>;
  perGuest: string;
  derivedFrom: (parent: string, offset: string) => string;
  derivedAria: (parent: string, offset: string) => string;
  derivedName: (name: string) => string;
  parentFallback: string;
  thisPlan: string;
  rateSource: { default: (plan: string) => string; derived: (parent: string) => string; none: (plan: string) => string };
  warn: {
    perPlan: string;
    overCapOoo: (inv: number, usable: number, unit: string, blocked: number) => string;
    overCapPhysical: (inv: number, physical: number, unit: string, usable: number) => string;
    unit: (kind: "bed" | "room") => string;
    stopEverywhere: (remaining: number) => string;
    /** The same closure, when a RevioCRS restriction rule is what closed it — the place to lift it differs. */
    stopByRule: (remaining: number) => string;
    nothingLeft: string;
  };
  cell: { past: string; pastWithNote: (note: string) => string; pastFlag: string };
  /** The small labels inside a month-view day. */
  monthCell: { minStay: (n: number) => string; nightsShort: string; stop: string; cta: string; ctd: string; sell: string; sold: string; rate: string };
  bulkEdit: string;
  bulkEditTitle: (roomType: string) => string;
  expandAll: string;
  collapseAll: string;
  selected: (n: number) => string;
  clear: string;
  apply: string;
  booking: {
    open: string;
    title: string;
    need: string;
    roomType: string;
    ratePlan: string;
    channel: string;
    intro: string;
    loop: string;
    guest: string;
    guestPlaceholder: string;
    checkIn: string;
    nights: string;
    roomsCount: string;
    cancel: string;
    booking: string;
    create: string;
  };
}

export const calendar: Translations<CmCalendarStrings> = {
  en: {
    title: "Calendar",
    subtitle: (p) => `${p} · availability, rates & restrictions`,
    emptyTitle: "No room types yet",
    emptyBody: "The calendar shows availability and rates per room type. Add your first room type to get started.",
    emptyAction: "Go to Rooms & Rates",
    grid: "Grid",
    month: "Month",
    days: (n) => `${n}d`,
    prevWindow: "Previous window",
    nextWindow: "Next window",
    today: "Today",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    thisMonth: "This month",
    go: "Go",
    endHint: "Optional end date — the view caps at 30 consecutive days",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    rooms: "Rooms",
    all: "All",
    rates: "Rates",
    ratesDefault: "Standard + derived",
    display: "Display",
    displayDefault: "Default",
    legend: { stop: "Stop Sell", cta: "CTA", ctd: "CTD", weekend: "Weekend" },
    limitations: "Channel limitations (not errors): ",
    ignores: (c, w) => `${c} ignores ${w}`,
    noMatch: "No room types match the filter — clear the Rooms filter above.",
    units: (n, kind) => `${n} ${kind === "bed" ? "beds" : "rooms"}`,
    gridFootnote: "Rooms sold comes from your confirmed reservations; bookable = rooms to sell − sold. Derived rates follow the standard rate automatically. Every edit is pushed to your connected channels.",
    monthFootnote: "Same logic as the grid view — edits write the same rooms-to-sell and standard rate, derived rates follow, and changes push to channels on real connectivity. Badge ",
    minStayBadge: " = minimum stay.",
    rows: { inventory: "Allocation", sold: "Rooms sold", bookable: "Bookable", minlos: "Min LOS", cta: "CTA", ctd: "CTD", stopsell: "Stop Sell" },
    rowGroups: { sold: "Rooms sold", minlos: "Min LOS", cta: "CTA", ctd: "CTD", stopsell: "Stop sell" },
    capLabels: { cta: "CTA", ctd: "CTD", min_los: "Min LOS", max_los: "Max LOS", advance_purchase_min: "Adv. purchase min", advance_purchase_max: "Adv. purchase max", stop_sell: "Stop sell" },
    perGuest: "per-guest pricing (sells at your main guest count)",
    derivedFrom: (p, o) => `Derived from ${p} · ${o}`,
    derivedAria: (p, o) => `Derived rate (${p} ${o})`,
    derivedName: (n) => `${n} (derived)`,
    parentFallback: "its parent plan",
    thisPlan: "This plan",
    rateSource: {
      default: (plan) => `No price set for this night — it sells at ${plan}'s default rate, and that is what the channels are sent. Type a price to override it.`,
      derived: (parent) => `Follows ${parent} — change the parent's price and this moves with it.`,
      none: (plan) => `${plan} has no price for this night and no default rate, so it cannot be sold. Set a price, or a default rate in Rooms & Rates.`,
    },
    warn: {
      perPlan: "Some rate plans have their own restriction on this date — set in Bulk Update. This row shows the room's.",
      overCapOoo: (inv, usable, unit, blocked) => `${inv} allocated, but only ${usable} ${unit} are usable on this date (${blocked} out of order or closed) — ${usable} is what the channel is sent`,
      overCapPhysical: (inv, physical, unit, usable) => `${inv} allocated, but only ${physical} physical ${unit} exist — ${usable} is what the channel is sent`,
      unit: (kind) => (kind === "bed" ? "beds" : "rooms"),
      stopEverywhere: (r) => `Stop-sell on every rate plan — the channels are sent 0, although ${r} ${r === 1 ? "room is" : "rooms are"} free. Lift it in Bulk Update → Stop sell.`,
      stopByRule: (r) => `Stop-sell on every rate plan, set by a restriction rule in RevioCRS — the channels are sent 0, although ${r} ${r === 1 ? "room is" : "rooms are"} free. Change it in RevioCRS → Bulk Rates & Availability → Your active restriction rules.`,
      nothingLeft: "Nothing left to sell on this date — the channel has been told 0",
    },
    cell: {
      past: "This date has passed — rates and availability can only be changed from today onwards",
      pastWithNote: (n) => `${n} This date has passed.`,
      pastFlag: "This date has passed",
    },
    monthCell: { minStay: (n) => `Min stay ${n} nights`, nightsShort: "n", stop: "Stop sell", cta: "Closed to arrival", ctd: "Closed to departure", sell: "Sell", sold: "Sold", rate: "Rate" },
    bulkEdit: "Bulk edit",
    bulkEditTitle: (rt) => `Bulk edit · ${rt}`,
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    selected: (n) => `${n} selected`,
    clear: "Clear",
    apply: "Apply",
    booking: {
      open: "Simulate booking",
      title: "Simulate a channel booking",
      need: "To simulate a booking you need at least one room type, one rate plan and one connected channel. Add them in Rooms & Rates and Channels first.",
      intro: "Books on a (mock) channel, imports the reservation, drops availability for those nights, and re-pushes — the full ",
      loop: "edit → book → pull → re-push",
      roomType: "Room type",
      ratePlan: "Rate plan",
      channel: "Channel",
      guest: "Guest name",
      guestPlaceholder: "Walk-in Guest",
      checkIn: "Check-in",
      nights: "Nights",
      roomsCount: "Rooms",
      cancel: "Cancel",
      booking: "Booking…",
      create: "Create booking",
    },
  },
  bg: {
    title: "Календар",
    subtitle: (p) => `${p} · наличност, цени и ограничения`,
    emptyTitle: "Все още няма типове стаи",
    emptyBody: "Календарът показва наличността и цените за всеки тип стая. Добавете първия тип стая, за да започнете.",
    emptyAction: "Към „Стаи и цени“",
    grid: "Таблица",
    month: "Месец",
    days: (n) => `${n} дни`,
    prevWindow: "По-рано",
    nextWindow: "По-късно",
    today: "Днес",
    prevMonth: "Предишен месец",
    nextMonth: "Следващ месец",
    thisMonth: "Този месец",
    go: "Отиди",
    endHint: "Крайна дата по желание — изгледът показва до 30 последователни дни",
    months: ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"],
    weekdays: ["пн", "вт", "ср", "чт", "пт", "сб", "нд"],
    monthsShort: ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"],
    rooms: "Стаи",
    all: "Всички",
    rates: "Цени",
    ratesDefault: "Основни + производни",
    display: "Редове",
    displayDefault: "По подразбиране",
    legend: { stop: "Стоп продажби", cta: "CTA (без пристигане)", ctd: "CTD (без напускане)", weekend: "Уикенд" },
    limitations: "Ограничения на каналите (не са грешки): ",
    ignores: (c, w) => `${c} не поддържа ${w}`,
    noMatch: "Няма типове стаи, отговарящи на филтъра — изчистете филтъра „Стаи“ горе.",
    units: (n, kind) => kind === "bed" ? `${n} ${n === 1 ? "легло" : "легла"}` : `${n} ${n === 1 ? "стая" : "стаи"}`,
    gridFootnote: "Продадените стаи идват от потвърдените резервации; налични = капацитет − продадени. Производните цени следват основната автоматично. Всяка промяна се изпраща към свързаните канали.",
    monthFootnote: "Същата логика като в таблицата — промените записват същия капацитет и основна цена, производните цени следват, а промените се изпращат към каналите при реална връзка. Значката ",
    minStayBadge: " = минимален престой.",
    rows: { inventory: "Капацитет", sold: "Продадени", bookable: "Налични", minlos: "Мин. престой", cta: "CTA", ctd: "CTD", stopsell: "Стоп продажби" },
    rowGroups: { sold: "Продадени", minlos: "Мин. престой", cta: "CTA", ctd: "CTD", stopsell: "Стоп продажби" },
    capLabels: { cta: "CTA", ctd: "CTD", min_los: "мин. престой", max_los: "макс. престой", advance_purchase_min: "мин. предварителна резервация", advance_purchase_max: "макс. предварителна резервация", stop_sell: "стоп продажби" },
    perGuest: "цени по брой гости (продава по основния брой гости)",
    derivedFrom: (p, o) => `Производен от ${p} · ${o}`,
    derivedAria: (p, o) => `Производна цена (${p} ${o})`,
    derivedName: (n) => `${n} (производен)`,
    parentFallback: "основния си план",
    thisPlan: "Този план",
    rateSource: {
      default: (plan) => `За тази нощ няма зададена цена — продава се на цената по подразбиране на „${plan}“ и тя се изпраща към каналите. Въведете цена, за да я замените.`,
      derived: (parent) => `Следва „${parent}“ — променете цената на основния план и тази се променя с нея.`,
      none: (plan) => `„${plan}“ няма цена за тази нощ и няма цена по подразбиране, затова не може да се продава. Задайте цена тук или цена по подразбиране в „Стаи и цени“.`,
    },
    warn: {
      perPlan: "Някои ценови планове имат собствено ограничение за тази дата — зададено в Масови промени. Този ред показва ограничението на стаята.",
      overCapOoo: (inv, usable, unit, blocked) => `Капацитет ${inv}, но за тази дата се ползват само ${usable} ${unit} (${blocked} извън експлоатация или затворени) — към канала се изпраща ${usable}`,
      overCapPhysical: (inv, physical, unit, usable) => `Капацитет ${inv}, но физически съществуват само ${physical} ${unit} — към канала се изпраща ${usable}`,
      unit: (kind) => (kind === "bed" ? "легла" : "стаи"),
      stopEverywhere: (r) => `Стоп продажби за всички ценови планове — към каналите се изпраща 0, въпреки че ${r === 1 ? "1 стая е свободна" : `${r} стаи са свободни`}. Махнете го в Масови промени → Стоп продажби.`,
      stopByRule: (r) => `Стоп продажби за всички ценови планове от правило за ограничения в RevioCRS — към каналите се изпраща 0, въпреки че ${r === 1 ? "1 стая е свободна" : `${r} стаи са свободни`}. Променете го в RevioCRS → Масови промени → Вашите активни правила за ограничения.`,
      nothingLeft: "За тази дата няма какво да се продава — към канала е изпратено 0",
    },
    cell: {
      past: "Тази дата е минала — цените и наличността могат да се променят само от днес нататък",
      pastWithNote: (n) => `${n} Тази дата е минала.`,
      pastFlag: "Тази дата е минала",
    },
    monthCell: { minStay: (n) => `Минимален престой ${n} ${n === 1 ? "нощувка" : "нощувки"}`, nightsShort: "н", stop: "Стоп продажби", cta: "Затворено за пристигане", ctd: "Затворено за напускане", sell: "Кап.", sold: "Прод.", rate: "Цена" },
    bulkEdit: "Масова промяна",
    bulkEditTitle: (rt) => `Масова промяна · ${rt}`,
    expandAll: "Разгъни всички",
    collapseAll: "Свий всички",
    selected: (n) => `${n} избрани`,
    clear: "Изчисти",
    apply: "Приложи",
    booking: {
      open: "Симулирай резервация",
      title: "Симулиране на резервация от канал",
      need: "За да симулирате резервация, Ви трябват поне един тип стая, един ценови план и един свързан канал. Добавете ги първо в „Стаи и цени“ и „Канали“.",
      intro: "Резервира през (тестов) канал, внася резервацията, намалява наличността за тези нощувки и изпраща отново — целият цикъл ",
      loop: "промяна → резервация → изтегляне → повторно изпращане",
      roomType: "Тип стая",
      ratePlan: "Ценови план",
      channel: "Канал",
      guest: "Име на госта",
      guestPlaceholder: "Гост без резервация",
      checkIn: "Настаняване",
      nights: "Нощувки",
      roomsCount: "Стаи",
      cancel: "Отказ",
      booking: "Резервиране…",
      create: "Създай резервация",
    },
  },
};
