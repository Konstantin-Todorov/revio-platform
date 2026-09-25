import type { Translations } from "@revio/ui/i18n";
import type { PlanTreeStrings } from "@revio/ui/plan-tree";

/**
 * Bulk Rates & Availability — one edit across many dates, and the standing restriction rules.
 *
 * `precedence` and `mainGuestNote` are core's English sentences (`PRECEDENCE_LINE`,
 * `resolveMainGuestCount().note`) worded here by `basis`, so they can be Bulgarian; the drift test
 * holds the English to core. `tree` is what the shared `PlanTree` prints — RevioLink passes nothing
 * and keeps its English.
 */
export interface BulkStrings {
  title: string;
  subtitle: (property: string) => string;
  tabsLabel: string;
  tabs: { change: string; rules: string };
  cardTitle: string;
  cardSubtitle: string;
  noRooms: string;
  addRoom: string;
  rules: {
    title: string;
    subtitle: string;
    empty: string;
    cols: { rule: string; type: string; dates: string; room: string; sources: string; value: string; status: string };
    all: string;
    allSources: string;
    on: string;
    active: string;
    off: string;
    deleteNote: string;
    whichWins: string;
  };
  precedence: string;
  mainGuestNote: { derived: string; fallback: string };
  sources: Record<"direct" | "ota" | "gds" | "call_center" | "corporate" | "travel_agent", string>;
  ruleTypes: Record<"min_los" | "max_los" | "stop_sell" | "cta" | "ctd" | "advance_purchase_min" | "advance_purchase_max", string>;
  dialog: {
    edit: string;
    add: string;
    editTitle: (name: string) => string;
    addTitle: string;
    name: string;
    namePlaceholder: string;
    type: string;
    from: string;
    to: string;
    value: string;
    valueHint: string;
    roomType: string;
    allRooms: string;
    channels: string;
    sources: string;
    sourcesHint: string;
    priority: string;
    priorityHint: string;
    active: string;
    cancel: string;
    saving: string;
    saveChanges: string;
    create: string;
  };
  panel: {
    from: string;
    to: string;
    days: string;
    dow: Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", string>;
    everyDayHint: string;
    everyDay: string;
    whichPlans: string;
    plansHint: string;
    fillOnly: string;
    tabs: { rates: string; availability: string; restrictions: string };
    derivedNote: string;
    price: string;
    noChange: string;
    rateModes: Record<"set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt", string>;
    value: string;
    valueIn: (unit: string) => string;
    allocation: string;
    allocationHint: string;
    allocationNote: string;
    minStay: string;
    maxStay: string;
    minAdvance: string;
    maxAdvance: string;
    cta: string;
    ctd: string;
    closed: string;
    open: string;
    planStatus: string;
    openSell: string;
    closeStop: string;
    clearHint: string;
    preview: string;
    errors: { noRoom: string; dates: string; nothing: string };
    reviewTitle: string;
    resultTitle: string;
    roomTypes: string;
    dates: string;
    changes: string;
    cancel: string;
    applying: string;
    apply: string;
    success: string;
    applied: (n: number) => string;
    failed: string;
    failedFallback: string;
    done: string;
  };
  summary: {
    cleared: string;
    days: (n: number) => string;
    amount: (value: number, unit: "%" | "€") => string;
    standardPlan: string;
    everyManualPlan: string;
    price: (mode: string, amount: string, plans: string) => string;
    derived: (n: number, names: string) => string;
    perGuest: (list: string, plans: string) => string;
    guestPrice: (occupancy: number, price: string) => string;
    skipped: (rooms: string) => string;
    allocation: (n: number) => string;
    minStay: (v: string) => string;
    maxStay: (v: string) => string;
    cta: (on: boolean) => string;
    ctd: (on: boolean) => string;
    stopSell: (closed: boolean) => string;
    minAdvance: (v: string) => string;
    maxAdvance: (v: string) => string;
  };
  matrix: {
    title: string;
    oneRule: string;
    eachOne: string;
    guests: (n: number) => string;
    assumed: string;
    mainPrice: string;
    extraGuest: string;
    appliedOnce: (p: number) => string;
    noChange: string;
    ops: Record<"set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt", string>;
    short: (n: number) => string;
    notApplied: (rooms: string[]) => string;
    skippedNote: string;
  };
  tree: PlanTreeStrings & { count: NonNullable<PlanTreeStrings["count"]> };
}

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const bulk: Translations<BulkStrings> = {
  en: {
    title: "Bulk Rates & Availability",
    subtitle: (p) => `${p} · date-scoped rate, restriction and open/close edits in one operation`,
    tabsLabel: "Bulk views",
    tabs: { change: "Change prices & availability", rules: "Your active restriction rules" },
    cardTitle: "Bulk update",
    cardSubtitle: "One run, one entry in the audit log, sent once to your channel manager",
    noRooms: "A bulk update changes rates and restrictions across your room types — so you need at least one first.",
    addRoom: "Add a room type",
    rules: {
      title: "Your active restriction rules",
      subtitle: "Standing rules for a date range, optionally aimed at one booking source — for example, closed to travel agents during a trade fair",
      empty: "No rules yet — add one to apply a restriction across a range of dates.",
      cols: { rule: "Rule", type: "Type", dates: "Dates", room: "Room", sources: "Sources", value: "Value", status: "Status" },
      all: "All",
      allSources: "All sources",
      on: "on",
      active: "active",
      off: "off",
      deleteNote: "Dates covered by this rule fall back to the plan/property defaults.",
      whichWins: "Which setting wins:",
    },
    precedence: "a date you edit directly (on the calendar or in bulk — the most recent edit wins) beats a restriction rule, which beats a rate plan's own default, which beats the property default",
    mainGuestNote: {
      derived: "Taken from your rooms — nobody has set this yet.",
      fallback: "No rooms to work it out from — assuming 2 until you set it.",
    },
    sources: { direct: "Direct", ota: "OTA", gds: "GDS", call_center: "Call Center", corporate: "Corporate", travel_agent: "Travel Agent" },
    ruleTypes: {
      min_los: "Min LOS", max_los: "Max LOS", stop_sell: "Stop Sell", cta: "Closed to Arrival", ctd: "Closed to Departure",
      advance_purchase_min: "Advance Purchase (min)", advance_purchase_max: "Advance Purchase (max)",
    },
    dialog: {
      edit: "Edit rule",
      add: "Add Rule",
      editTitle: (n) => `Edit ${n}`,
      addTitle: "Add Restriction Rule",
      name: "Rule name",
      namePlaceholder: "Easter Minimum Stay",
      type: "Type",
      from: "From",
      to: "To",
      value: "Value",
      valueHint: "Days/nights",
      roomType: "Room type",
      allRooms: "All rooms",
      channels: "Channels",
      sources: "Booking sources",
      sourcesHint: "(none checked = every source)",
      priority: "Priority",
      priorityHint: "Higher wins",
      active: "Active",
      cancel: "Cancel",
      saving: "Saving…",
      saveChanges: "Save changes",
      create: "Create rule",
    },
    panel: {
      from: "From",
      to: "To",
      days: "Days of week",
      dow: { "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "0": "Sun" },
      everyDayHint: "Leave all off to apply to every day.",
      everyDay: "every day",
      whichPlans: "Which rate plans would you like to apply these changes to?",
      plansHint: "A price lands on the plans you tick. Allocation and restrictions are written per room type, so they apply to every room with something ticked under it.",
      fillOnly: "Fill only the fields you want to change — the rest stay as they are. At least one is required.",
      tabs: { rates: "Rates", availability: "Availability", restrictions: "Restrictions" },
      derivedNote: "Derived plans follow the plan they come from — change it and they recompute. You only ever edit the parent, and the preview names every plan that moves with it.",
      price: "Price",
      noChange: "— No change —",
      rateModes: {
        set: "Set exact price (€) on the selected plans", inc_pct: "Increase by %", dec_pct: "Decrease by %",
        inc_amt: "Increase by amount (€)", dec_amt: "Decrease by amount (€)",
      },
      value: "Value",
      valueIn: (u) => `Value (${u})`,
      allocation: "Allocation",
      allocationHint: "The gross number you offer — Bookable subtracts what is sold",
      allocationNote: "Sets the number of rooms offered for sale on each selected day, per room type. Leave empty to change nothing.",
      minStay: "Min stay (nights)",
      maxStay: "Max stay (nights)",
      minAdvance: "Min advance (days)",
      maxAdvance: "Max advance (days)",
      cta: "Closed to arrival",
      ctd: "Closed to departure",
      closed: "Closed",
      open: "Open",
      planStatus: "Rate plan status",
      openSell: "Open (sell)",
      closeStop: "Close (stop-sell)",
      clearHint: "Min/max stay & advance: enter 0 to clear an existing value.",
      preview: "Preview & apply",
      errors: {
        noRoom: "Select at least one room type.",
        dates: "End date is before start date.",
        nothing: "Set at least one field to update.",
      },
      reviewTitle: "Review bulk update",
      resultTitle: "Bulk update",
      roomTypes: "Room types:",
      dates: "Dates:",
      changes: "Changes to apply",
      cancel: "Cancel",
      applying: "Applying…",
      apply: "Apply",
      success: "Successful",
      applied: (n) => `Applied to ${n} cell${n === 1 ? "" : "s"} and pushed to the connected channel manager.`,
      failed: "Not successful",
      failedFallback: "The update could not be applied.",
      done: "Done",
    },
    summary: {
      cleared: "cleared",
      days: (n) => `${n} days`,
      amount: (v, u) => `${v}${u}`,
      standardPlan: "standard plan",
      everyManualPlan: "every manual plan",
      price: (mode, amount, plans) => `Price — ${mode}: ${amount} · on ${plans}`,
      derived: (n, names) => `…and ${n} derived plan${n === 1 ? "" : "s"} recompute off it: ${names}`,
      perGuest: (list, plans) => `Price per guest count — ${list} · on ${plans}`,
      guestPrice: (o, p) => `${o}p ${p}`,
      skipped: (r) => `…skipped where the room sleeps fewer: ${r}`,
      allocation: (n) => `Allocation → ${n}`,
      minStay: (v) => `Min stay → ${v}`,
      maxStay: (v) => `Max stay → ${v}`,
      cta: (on) => `Closed to arrival → ${on ? "on" : "off"}`,
      ctd: (on) => `Closed to departure → ${on ? "on" : "off"}`,
      stopSell: (c) => `Stop-sell → ${c ? "closed" : "open"}`,
      minAdvance: (v) => `Min advance → ${v}`,
      maxAdvance: (v) => `Max advance → ${v}`,
    },
    matrix: {
      title: "Price per guest count",
      oneRule: "One rule",
      eachOne: "Each one",
      guests: (n) => `${n} guests`,
      assumed: " · assumed",
      mainPrice: "Main price (€)",
      extraGuest: "each extra guest",
      appliedOnce: (p) => `Applied once per guest above ${p} — so ${p + 1} guests gets it once and ${p + 2} gets it twice.`,
      noChange: "— no change —",
      ops: { set: "Set to €", inc_pct: "Increase by %", dec_pct: "Decrease by %", inc_amt: "Increase by €", dec_amt: "Decrease by €" },
      short: (n) => `${n}p`,
      notApplied: (r) => `Not applied to ${r.join(", ")} — ${r.length === 1 ? "it does" : "they do"} not sleep that many`,
      skippedNote: "* Skipped for rooms that do not sleep that many — never sent as a price they cannot take.",
    },
    tree: {
      search: "Search a plan or room, by name or code…",
      selectAll: "Select all",
      inverse: "Inverse",
      clear: "Clear",
      nothingMatches: (q) => `Nothing matches “${q}”.`,
      expand: (r) => `Expand ${r}`,
      collapse: (r) => `Collapse ${r}`,
      roomOnlyTitle: "No rate plan you can edit is linked to this room. Allocation and restrictions still apply to it; a price change does not.",
      roomOnlyBadge: "allocation & restrictions only",
      roomItself: "the room itself — allocation & restrictions",
      follows: (p) => `follows ${p}`,
      itsParent: "its parent",
      inactive: "inactive",
      count: (plans, rooms, roomOnly) => {
        if (plans === 0 && roomOnly === 0) return "Nothing selected";
        const bare = `${roomOnly} room type${roomOnly === 1 ? "" : "s"} with no editable plans`;
        if (plans === 0) return `Selected ${bare}`;
        const main = `Selected ${plans} rate plan${plans === 1 ? "" : "s"} across ${rooms} room type${rooms === 1 ? "" : "s"}`;
        return roomOnly === 0 ? main : `${main}, plus ${bare}`;
      },
    },
  },
  bg: {
    title: "Масови промени",
    subtitle: (p) => `${p} · цени, ограничения и отваряне/затваряне за период с една операция`,
    tabsLabel: "Изгледи на масовите промени",
    tabs: { change: "Промяна на цени и наличност", rules: "Вашите активни правила за ограничения" },
    cardTitle: "Масова промяна",
    cardSubtitle: "Едно изпълнение, един запис в журнала, изпраща се веднъж към каналния мениджър",
    noRooms: "Масовата промяна сменя цени и ограничения по типове стаи — затова първо Ви трябва поне един.",
    addRoom: "Добавете тип стая",
    rules: {
      title: "Вашите активни правила за ограничения",
      subtitle: "Постоянни правила за период, по желание само за един източник на резервации — например затворено за туристически агенти по време на изложение",
      empty: "Все още няма правила — добавете, за да приложите ограничение за период от дати.",
      cols: { rule: "Правило", type: "Вид", dates: "Дати", room: "Стая", sources: "Източници", value: "Стойност", status: "Статус" },
      all: "Всички",
      allSources: "Всички източници",
      on: "вкл.",
      active: "активно",
      off: "изкл.",
      deleteNote: "За датите на това правило отново важат настройките на плана или на обекта.",
      whichWins: "Коя настройка важи:",
    },
    precedence: "дата, която редактирате директно (в календара или масово — важи последната промяна), е с предимство пред правило за ограничение, то — пред настройката на ценовия план, а тя — пред настройката на обекта",
    mainGuestNote: {
      derived: "Изчислено от стаите Ви — никой още не го е задал.",
      fallback: "Няма стаи, от които да се изчисли — приема се 2, докато не го зададете.",
    },
    sources: { direct: "Директно", ota: "OTA", gds: "GDS", call_center: "Кол център", corporate: "Корпоративни", travel_agent: "Туристически агенти" },
    ruleTypes: {
      min_los: "Мин. престой", max_los: "Макс. престой", stop_sell: "Стоп продажби", cta: "Затворено за пристигане",
      ctd: "Затворено за напускане", advance_purchase_min: "Предварителна резервация (мин.)",
      advance_purchase_max: "Предварителна резервация (макс.)",
    },
    dialog: {
      edit: "Редактирай правилото",
      add: "Добави правило",
      editTitle: (n) => `Редактиране на ${n}`,
      addTitle: "Ново правило за ограничение",
      name: "Име на правилото",
      namePlaceholder: "Минимален престой за Великден",
      type: "Вид",
      from: "От",
      to: "До",
      value: "Стойност",
      valueHint: "Дни/нощувки",
      roomType: "Тип стая",
      allRooms: "Всички стаи",
      channels: "Канали",
      sources: "Източници на резервации",
      sourcesHint: "(нищо отметнато = всички източници)",
      priority: "Приоритет",
      priorityHint: "По-високият печели",
      active: "Активно",
      cancel: "Отказ",
      saving: "Запазване…",
      saveChanges: "Запази промените",
      create: "Създай правило",
    },
    panel: {
      from: "От",
      to: "До",
      days: "Дни от седмицата",
      dow: { "1": "пн", "2": "вт", "3": "ср", "4": "чт", "5": "пт", "6": "сб", "0": "нд" },
      everyDayHint: "Оставете всички неотметнати, за да важи за всеки ден.",
      everyDay: "всеки ден",
      whichPlans: "За кои ценови планове да се приложат промените?",
      plansHint: "Цената се записва в отметнатите планове. Капацитетът и ограниченията се записват по тип стая, така че важат за всяка стая, под която има нещо отметнато.",
      fillOnly: "Попълнете само полетата, които искате да промените — останалите остават както са. Нужно е поне едно.",
      tabs: { rates: "Цени", availability: "Наличност", restrictions: "Ограничения" },
      derivedNote: "Производните планове следват плана, от който идват — промените го и те се преизчисляват. Винаги редактирате само основния план, а прегледът назовава всеки план, който се променя с него.",
      price: "Цена",
      noChange: "— Без промяна —",
      rateModes: {
        set: "Точна цена (€) за избраните планове", inc_pct: "Увеличение с %", dec_pct: "Намаление с %",
        inc_amt: "Увеличение със сума (€)", dec_amt: "Намаление със сума (€)",
      },
      value: "Стойност",
      valueIn: (u) => `Стойност (${u})`,
      allocation: "Капацитет",
      allocationHint: "Общият брой, който предлагате — „Налични“ изважда продадените",
      allocationNote: "Задава колко стаи се предлагат за продажба във всеки избран ден, по тип стая. Оставете празно, за да не се променя нищо.",
      minStay: "Мин. престой (нощувки)",
      maxStay: "Макс. престой (нощувки)",
      minAdvance: "Мин. предварително (дни)",
      maxAdvance: "Макс. предварително (дни)",
      cta: "Затворено за пристигане",
      ctd: "Затворено за напускане",
      closed: "Затворено",
      open: "Отворено",
      planStatus: "Статус на ценовия план",
      openSell: "Отворен (продава се)",
      closeStop: "Затворен (стоп продажби)",
      clearHint: "Мин./макс. престой и предварителна резервация: въведете 0, за да изчистите стойност.",
      preview: "Преглед и прилагане",
      errors: {
        noRoom: "Изберете поне един тип стая.",
        dates: "Крайната дата е преди началната.",
        nothing: "Задайте поне едно поле за промяна.",
      },
      reviewTitle: "Преглед на масовата промяна",
      resultTitle: "Масова промяна",
      roomTypes: "Типове стаи:",
      dates: "Дати:",
      changes: "Промени за прилагане",
      cancel: "Отказ",
      applying: "Прилагане…",
      apply: "Приложи",
      success: "Успешно",
      applied: (n) => `Приложено за ${s(n, "клетка", "клетки")} и изпратено към свързания канален мениджър.`,
      failed: "Неуспешно",
      failedFallback: "Промяната не можа да бъде приложена.",
      done: "Готово",
    },
    summary: {
      cleared: "изчистено",
      days: (n) => s(n, "ден", "дни"),
      amount: (v, u) => (u === "€" ? `${v} €` : `${v}%`),
      standardPlan: "основния план",
      everyManualPlan: "всеки ръчен план",
      price: (mode, amount, plans) => `Цена — ${mode}: ${amount} · за ${plans}`,
      derived: (n, names) => `…и ${n === 1 ? "1 производен план се преизчислява" : `${n} производни плана се преизчисляват`} от нея: ${names}`,
      perGuest: (list, plans) => `Цена по брой гости — ${list} · за ${plans}`,
      guestPrice: (o, p) => `${o} ${o === 1 ? "гост" : "гости"} ${p}`,
      skipped: (r) => `…пропуска се, където стаята е за по-малко гости: ${r}`,
      allocation: (n) => `Капацитет → ${n}`,
      minStay: (v) => `Мин. престой → ${v}`,
      maxStay: (v) => `Макс. престой → ${v}`,
      cta: (on) => `Затворено за пристигане → ${on ? "вкл." : "изкл."}`,
      ctd: (on) => `Затворено за напускане → ${on ? "вкл." : "изкл."}`,
      stopSell: (c) => `Стоп продажби → ${c ? "затворено" : "отворено"}`,
      minAdvance: (v) => `Мин. предварително → ${v}`,
      maxAdvance: (v) => `Макс. предварително → ${v}`,
    },
    matrix: {
      title: "Цена по брой гости",
      oneRule: "Едно правило",
      eachOne: "Поотделно",
      guests: (n) => s(n, "гост", "гости"),
      assumed: " · прието",
      mainPrice: "Основна цена (€)",
      extraGuest: "всеки допълнителен гост",
      appliedOnce: (p) => `Прилага се веднъж за всеки гост над ${p} — ${p + 1} гости го получават веднъж, ${p + 2} — два пъти.`,
      noChange: "— без промяна —",
      ops: { set: "Точно €", inc_pct: "Увеличение с %", dec_pct: "Намаление с %", inc_amt: "Увеличение с €", dec_amt: "Намаление с €" },
      short: (n) => s(n, "гост", "гости"),
      notApplied: (r) => `Не се прилага за ${r.join(", ")} — ${r.length === 1 ? "стаята не е" : "стаите не са"} за толкова гости`,
      skippedNote: "* Пропуска се за стаи, които не са за толкова гости — никога не се изпраща цена, която не могат да приемат.",
    },
    tree: {
      search: "Търсене на план или стая по име или код…",
      selectAll: "Избери всички",
      inverse: "Обърни",
      clear: "Изчисти",
      nothingMatches: (q) => `Нищо не съвпада с „${q}“.`,
      expand: (r) => `Разгъни ${r}`,
      collapse: (r) => `Свий ${r}`,
      roomOnlyTitle: "Към тази стая няма ценови план, който можете да редактирате. Капацитетът и ограниченията важат за нея; промяна на цената — не.",
      roomOnlyBadge: "само капацитет и ограничения",
      roomItself: "самата стая — капацитет и ограничения",
      follows: (p) => `следва ${p}`,
      itsParent: "основния си план",
      inactive: "неактивен",
      count: (plans, rooms, roomOnly) => {
        if (plans === 0 && roomOnly === 0) return "Нищо не е избрано";
        const bare = `${s(roomOnly, "тип стая", "типа стаи")} без планове за редакция`;
        if (plans === 0) return `Избрани: ${bare}`;
        const main = `Избрани: ${s(plans, "ценови план", "ценови плана")} в ${s(rooms, "тип стая", "типа стаи")}`;
        return roomOnly === 0 ? main : `${main} и ${bare}`;
      },
    },
  },
};
