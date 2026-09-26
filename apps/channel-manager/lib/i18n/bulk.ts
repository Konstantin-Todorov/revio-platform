import type { Translations } from "@revio/ui/i18n";
import type { PlanTreeStrings } from "@revio/ui/plan-tree";

/**
 * RevioLink's Bulk Rates & Restrictions — the mass editor, the standing rules and the rule dialog.
 *
 * Most words are RevioCRS's (`reservation/lib/i18n/bulk.ts`) for the same controls, so a hotel
 * running both reads one vocabulary. What differs is RevioLink's own: the queue of changes sent as
 * one update, the channel column on rules, and a rule narrowed to one rate plan.
 */
export interface CmBulkStrings {
  title: string;
  subtitle: string;
  tabsLabel: string;
  tabs: { change: string; rules: string };
  noRooms: string;
  addRoom: string;
  rules: {
    title: string;
    cols: { rule: string; type: string; appliesTo: string; dates: string; channels: string; value: string; status: string };
    all: string;
    ignoredTitle: string;
    ignoredBy: (channels: string) => string;
    active: string;
    inactive: string;
    empty: string;
    precedence: string;
  };
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
    ratePlan: string;
    ratePlanHint: string;
    allRatePlans: string;
    channels: string;
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
    price: string;
    noChange: string;
    rateModes: Record<"set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt", string>;
    value: string;
    allocation: string;
    allocationHint: string;
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
    clearHint: (zero: string) => [string, string];
    errors: { noRoom: string; dates: string; nothing: string };
    queued: (n: number) => string;
    removeChange: (i: number) => string;
    addAnotherTitle: string;
    addAnother: string;
    preview: string;
    reviewTitle: string;
    resultTitle: string;
    single: string;
    many: (n: number) => string;
    changeN: (i: number) => string;
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
    standardPlan: string;
    price: (mode: string, amount: string, plans: string) => string;
    allocation: (n: number) => string;
    minStay: (v: string) => string;
    maxStay: (v: string) => string;
    cta: (on: boolean) => string;
    ctd: (on: boolean) => string;
    stopSell: (closed: boolean) => string;
    minAdvance: (v: string) => string;
    maxAdvance: (v: string) => string;
  };
  tree: PlanTreeStrings & { count: NonNullable<PlanTreeStrings["count"]> };
}

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const bulk: Translations<CmBulkStrings> = {
  en: {
    title: "Bulk Rates & Restrictions",
    subtitle: "Mass edits across dates and rooms, plus the standing restriction rules",
    tabsLabel: "Bulk views",
    tabs: { change: "Change prices & availability", rules: "Your active restriction rules" },
    noRooms: "A bulk update changes rates and restrictions across your room types — so you need at least one first.",
    addRoom: "Add a room type",
    rules: {
      title: "Your active restriction rules",
      cols: { rule: "Rule", type: "Type", appliesTo: "Applies to", dates: "Date range", channels: "Channels", value: "Value", status: "Status" },
      all: "All",
      ignoredTitle: "These channels don't support this restriction type — the rule is skipped for them (a limitation, not an error).",
      ignoredBy: (c) => `ignored by ${c}`,
      active: "Active",
      inactive: "Inactive",
      empty: "No standing rules yet — add one to apply a restriction across a date range and channels.",
      precedence: "Which value wins, in order: a date-scoped edit (calendar or bulk — the most recent one) > a restriction rule > the rate-plan default > the property default.",
    },
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
      ratePlan: "Rate plan",
      ratePlanHint: "Narrower than the room",
      allRatePlans: "All rate plans",
      channels: "Channels",
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
      plansHint: "A price lands on the plans you tick. Allocation and restrictions are written per room type, so they apply to every room with something ticked under it — derived plans included.",
      fillOnly: "Fill only the fields you want to change — the rest stay as they are. At least one is required.",
      price: "Price",
      noChange: "— No change —",
      rateModes: {
        set: "Set exact price (€)", inc_pct: "Increase by %", dec_pct: "Decrease by %",
        inc_amt: "Increase by amount (€)", dec_amt: "Decrease by amount (€)",
      },
      value: "Value",
      allocation: "Allocation",
      allocationHint: "The gross number you offer — Bookable subtracts what is sold",
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
      clearHint: () => ["Min/max stay & advance: enter ", " to clear an existing value."],
      errors: {
        noRoom: "Select at least one room type.",
        dates: "End date is before start date.",
        nothing: "Set at least one field to update.",
      },
      queued: (n) => `Queued — ${n} change${n === 1 ? "" : "s"}, sent as one update`,
      removeChange: (i) => `Remove change ${i}`,
      addAnotherTitle: "Set different values for other dates or rooms, and send them all in one update",
      addAnother: "Add another change",
      preview: "Preview & apply",
      reviewTitle: "Review bulk update",
      resultTitle: "Bulk update",
      single: "This will be applied and pushed to your channels.",
      many: (n) => `${n} changes, applied in order and pushed to your channels as one update.`,
      changeN: (i) => `Change ${i} — `,
      changes: "Changes to apply — ",
      cancel: "Cancel",
      applying: "Applying…",
      apply: "Apply",
      success: "Successful",
      applied: (n) => `Applied to ${n} cell${n === 1 ? "" : "s"} and pushed to channels.`,
      failed: "Not successful",
      failedFallback: "The update could not be applied.",
      done: "Done",
    },
    summary: {
      cleared: "cleared",
      days: (n) => ` ${n === 1 ? "day" : "days"}`,
      standardPlan: "standard plan",
      price: (mode, amount, plans) => `Price — ${mode}: ${amount} · on ${plans}`,
      allocation: (n) => `Allocation → ${n}`,
      minStay: (v) => `Min stay → ${v}`,
      maxStay: (v) => `Max stay → ${v}`,
      cta: (on) => `Closed to arrival → ${on ? "on" : "off"}`,
      ctd: (on) => `Closed to departure → ${on ? "on" : "off"}`,
      stopSell: (c) => `Stop-sell → ${c ? "closed" : "open"}`,
      minAdvance: (v) => `Min advance → ${v}`,
      maxAdvance: (v) => `Max advance → ${v}`,
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
    subtitle: "Масови промени по дати и стаи, плюс постоянните правила за ограничения",
    tabsLabel: "Изгледи на масовите промени",
    tabs: { change: "Промяна на цени и наличност", rules: "Вашите активни правила за ограничения" },
    noRooms: "Масовата промяна сменя цени и ограничения по типове стаи — затова първо Ви трябва поне един.",
    addRoom: "Добавете тип стая",
    rules: {
      title: "Вашите активни правила за ограничения",
      cols: { rule: "Правило", type: "Вид", appliesTo: "За", dates: "Период", channels: "Канали", value: "Стойност", status: "Статус" },
      all: "Всички",
      ignoredTitle: "Тези канали не поддържат този вид ограничение — правилото се пропуска за тях (ограничение на канала, не грешка).",
      ignoredBy: (c) => `не се поддържа от ${c}`,
      active: "Активно",
      inactive: "Неактивно",
      empty: "Все още няма постоянни правила — добавете, за да приложите ограничение за период и канали.",
      precedence: "Коя стойност важи, по ред: промяна за конкретна дата (в календара или масово — последната) > правило за ограничение > настройката на ценовия план > настройката на обекта.",
    },
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
      ratePlan: "Ценови план",
      ratePlanHint: "По-тясно от стаята",
      allRatePlans: "Всички ценови планове",
      channels: "Канали",
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
      plansHint: "Цената се записва в отметнатите планове. Капацитетът и ограниченията се записват по тип стая, така че важат за всяка стая, под която има нещо отметнато — включително производните планове.",
      fillOnly: "Попълнете само полетата, които искате да промените — останалите остават както са. Нужно е поне едно.",
      price: "Цена",
      noChange: "— Без промяна —",
      rateModes: {
        set: "Точна цена (€)", inc_pct: "Увеличение с %", dec_pct: "Намаление с %",
        inc_amt: "Увеличение със сума (€)", dec_amt: "Намаление със сума (€)",
      },
      value: "Стойност",
      allocation: "Капацитет",
      allocationHint: "Общият брой, който предлагате — „Налични“ изважда продадените",
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
      clearHint: () => ["Мин./макс. престой и предварителна резервация: въведете ", ", за да изчистите стойност."],
      errors: {
        noRoom: "Изберете поне един тип стая.",
        dates: "Крайната дата е преди началната.",
        nothing: "Задайте поне едно поле за промяна.",
      },
      queued: (n) => `На опашка — ${s(n, "промяна", "промени")}, изпращат се като една`,
      removeChange: (i) => `Премахни промяна ${i}`,
      addAnotherTitle: "Задайте различни стойности за други дати или стаи и ги изпратете всички наведнъж",
      addAnother: "Добави още промяна",
      preview: "Преглед и прилагане",
      reviewTitle: "Преглед на масовата промяна",
      resultTitle: "Масова промяна",
      single: "Промяната ще бъде приложена и изпратена към каналите Ви.",
      many: (n) => `${n} промени, прилагат се по ред и се изпращат към каналите като една.`,
      changeN: (i) => `Промяна ${i} — `,
      changes: "Промени за прилагане — ",
      cancel: "Отказ",
      applying: "Прилагане…",
      apply: "Приложи",
      success: "Успешно",
      applied: (n) => `Приложено за ${s(n, "клетка", "клетки")} и изпратено към каналите.`,
      failed: "Неуспешно",
      failedFallback: "Промяната не можа да бъде приложена.",
      done: "Готово",
    },
    summary: {
      cleared: "изчистено",
      days: (n) => ` ${n === 1 ? "ден" : "дни"}`,
      standardPlan: "основния план",
      price: (mode, amount, plans) => `Цена — ${mode}: ${amount} · за ${plans}`,
      allocation: (n) => `Капацитет → ${n}`,
      minStay: (v) => `Мин. престой → ${v}`,
      maxStay: (v) => `Макс. престой → ${v}`,
      cta: (on) => `Затворено за пристигане → ${on ? "вкл." : "изкл."}`,
      ctd: (on) => `Затворено за напускане → ${on ? "вкл." : "изкл."}`,
      stopSell: (c) => `Стоп продажби → ${c ? "затворено" : "отворено"}`,
      minAdvance: (v) => `Мин. предварително → ${v}`,
      maxAdvance: (v) => `Макс. предварително → ${v}`,
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
