import type { Translations } from "@revio/ui/i18n";
import type { OptionProblem } from "@revio/core";

/**
 * What RevioLink's calendar, bulk and rate actions say when they refuse. The shared words are
 * RevioCRS's (`reservation/lib/i18n/rate-errors.ts`), copied so one refusal reads the same in both
 * products; `cm` holds the ones only RevioLink says.
 *
 * Core decides WHETHER something is refused; the words are the reader's. `past` mirrors core's
 * `pastDateRefusal`, `problems` its `describeProblem` by kind —
 * the drift test holds all three to core's English.
 */
export interface RateErrorStrings {
  nameRequired: string;
  codeRequired: string;
  planCodeTaken: (code: string) => string;
  roomCodeTaken: (code: string) => string;
  derivedNeedsParent: string;
  pickType: string;
  pickRange: string;
  endBeforeStart: string;
  selectRoom: string;
  noDatesMatch: string;
  selectManualPlan: string;
  selectManualPlanForPrice: string;
  enterPrice: string;
  unknownUpdate: string;
  nothingToUpdate: string;
  planNotFound: string;
  planGone: string;
  chooseParent: string;
  selfParent: string;
  parentNotFound: string;
  loop: string;
  tooDeep: (max: number) => string;
  mustTraceToManual: string;
  roomNotFound: string;
  roomGone: string;
  roomGoneMaybe: string;
  planDeleted: string;
  ruleDeleted: string;
  nothingSelected: string;
  unreadableDate: string;
  rowCannotPrice: string;
  noManualPlan: string;
  badPrice: string;
  overPhysical: (v: number, rooms: string) => string;
  skippedOccupancy: (room: string, counts: number[]) => string;
  unpriced: (n: number) => string;
  noPlanLinked: (names: string, n: number) => string;
  /** Core's `pastDateRefusal`, in the reader's words. `label` is omitted for a calendar cell. */
  past: (label: string | null, date: string, earliest: string) => string;
  startDate: string;
  endDate: string;
  problems: { [K in OptionProblem["kind"]]: (p: Extract<OptionProblem, { kind: K }>) => string };
  /** Only RevioLink says these — the calendar cell, the bulk run, the demo booking, a cancel. */
  cm: {
    priceUnreadable: string;
    rowNotLinked: string;
    noPriceWritten: (because: string) => string;
    droppedWhy: { inactive: string; derived: string; elsewhere: string };
    droppedIs: (plan: string, why: string) => string;
    droppedNote: (list: string) => string;
    noPlanSold: (rooms: string, n: number) => string;
    nothingToApply: string;
    changeN: (i: number, error: string) => string;
    simulate: {
      fill: string;
      notConnected: string;
      demoOnly: string;
      notMapped: (channel: string) => string;
      noPrice: string;
      notImported: string;
      failedImport: string;
    };
    reservation: { gone: string; alreadyCancelled: string; inHouse: string };
  };
}

const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;

export const rateErrors: Translations<RateErrorStrings> = {
  en: {
    nameRequired: "Name is required.",
    codeRequired: "Code is required.",
    planCodeTaken: (c) => `Code "${c}" is already used by another rate plan.`,
    roomCodeTaken: (c) => `Code "${c}" is already used by another room type.`,
    derivedNeedsParent: "A derived rate needs a parent rate plan.",
    pickType: "Pick a restriction type.",
    pickRange: "Pick a date range.",
    endBeforeStart: "End date is before start date.",
    selectRoom: "Select at least one room type.",
    noDatesMatch: "No dates match those days of week.",
    selectManualPlan: "Select at least one manual rate plan (derived plans follow their parent).",
    selectManualPlanForPrice: "Select at least one manual rate plan for the price change (derived plans follow their parent).",
    enterPrice: "Enter a price value.",
    unknownUpdate: "Unknown update type.",
    nothingToUpdate: "Set at least one field to update.",
    planNotFound: "Rate plan not found.",
    planGone: "That rate plan no longer exists.",
    chooseParent: "Choose a parent rate plan.",
    selfParent: "A rate plan can’t derive from itself.",
    parentNotFound: "Parent rate plan not found.",
    loop: "That would create a loop — a rate can’t derive from one of its own descendants.",
    tooDeep: (m) => `Derivation chains are limited to ${m} levels — link to a plan closer to the base rate.`,
    mustTraceToManual: "A derived rate must ultimately trace back to a manual base rate.",
    roomNotFound: "Room type not found.",
    roomGone: "That room type no longer exists — somebody removed it while this page was open.",
    roomGoneMaybe: "That room type no longer exists — somebody may have removed it while this page was open.",
    planDeleted: "That rate plan no longer exists — somebody removed it while this page was open.",
    ruleDeleted: "That restriction rule no longer exists — somebody removed it while this page was open.",
    nothingSelected: "Nothing was selected to delete. Reload the page and try again.",
    unreadableDate: "That date isn’t one we can read. Reload the calendar and try again.",
    rowCannotPrice: "That rate row can no longer hold a price — the plan may have been switched off or made derived while this page was open. Reload the calendar.",
    noManualPlan: "This property has no active manual rate plan yet, so there is nothing to price. Add one in Rooms & Rates.",
    badPrice: "That price isn’t a number we can use. Enter an amount of zero or more.",
    overPhysical: (v, r) => `${v} to sell exceeds the physical count for ${r} — saved anyway, double-check the number.`,
    skippedOccupancy: (room, c) => `${room} does not sleep ${c.join(" or ")} — ${c.length === 1 ? "that guest count was" : "those guest counts were"} skipped for it.`,
    unpriced: (x) => `${x} price${x === 1 ? "" : "s"} had nothing to work from — a percentage needs an existing price. Set one first.`,
    noPlanLinked: (names, x) => `No price was written for ${names} — no rate plan you selected is linked to ${x === 1 ? "that room" : "those rooms"}.`,
    past: (label, d, e) => `${label ? `${label} of ${d}` : d} has already passed. The earliest you can pick is ${e}.`,
    startDate: "The start date",
    endDate: "The end date",
    problems: {
      "no-primary": () => "No primary occupancy is set. One occupancy must be primary — it is the rate shown by default and the one restrictions apply to.",
      "many-primaries": (p) => `More than one occupancy is marked primary (${p.occupancies.join(", ")}). Exactly one can be.`,
      "per-room-extra-rows": (p) => `A per-room plan has one price, but this has ${p.count}. Switch the plan to per-person, or remove the extra rows.`,
      "per-room-wrong-occupancy": (p) => `A per-room price covers the whole room, so it belongs at ${p.expected} guests, not ${p.found}.`,
      gap: (p) => `No price for ${p.missing.length === 1 ? "" : "these guest counts: "}${p.missing.join(", ")}. A per-person plan needs one for every count up to the room's maximum, or it cannot quote that booking.`,
      duplicate: (p) => `Two prices are set for ${p.occupancy} guests.`,
      "above-ceiling": (p) => `${p.occupancy} guests is more than this room sleeps (${p.ceiling}).`,
      "below-one": () => "A price cannot be set for fewer than one guest.",
      "derived-without-rule": (p) => `The price for ${p.occupancy} guests is set to be calculated, but no calculation is given.`,
      "primary-derived": () => "The primary occupancy cannot be calculated from itself — give it a price.",
    },
    cm: {
      priceUnreadable: "That price isn’t a number we can read. Enter an amount, or clear the cell to leave it unpriced.",
      rowNotLinked: "That price row is not linked to a rate plan that can hold a price. Reload the calendar — if it persists, check the plan is still active in Rooms & Rates.",
      noPriceWritten: (b) => `No price was written — none of the selected rate plans can hold one.${b} Pick a manual, active plan (derived plans follow their parent).`,
      droppedWhy: { inactive: "inactive", derived: "derived — it follows its parent", elsewhere: "not on this property" },
      droppedIs: (p, w) => `${p} is ${w}`,
      droppedNote: (l) => `No price was written for ${l}.`,
      noPlanSold: (r, x) => `${r} got no price — none of the selected rate plans is sold on ${x === 1 ? "it" : "them"}.`,
      nothingToApply: "Nothing to apply.",
      changeN: (i, e) => `Change ${i}: ${e}`,
      simulate: {
        fill: "Fill channel, room, rate and date.",
        notConnected: "That channel is not connected to this property.",
        demoOnly: "Simulated bookings only run on demo channels.",
        notMapped: (c) => `That room and rate are not mapped to ${c}, so the channel could not have sold them. Map them in Mapping first.`,
        noPrice: "This rate plan has no price for those nights and no default rate, so no channel is selling it.",
        notImported: "The booking could not be imported.",
        failedImport: "The channel sent the booking but it could not be imported — see the Error Center.",
      },
      reservation: {
        gone: "That reservation no longer exists — somebody may have removed it while this page was open.",
        alreadyCancelled: "That reservation is already cancelled.",
        inHouse: "This guest has already checked in. Check them out in RevioPMS to end the stay — cancelling would put an occupied room back on sale.",
      },
    },
  },
  bg: {
    nameRequired: "Името е задължително.",
    codeRequired: "Кодът е задължителен.",
    planCodeTaken: (c) => `Кодът „${c}“ вече се използва от друг ценови план.`,
    roomCodeTaken: (c) => `Кодът „${c}“ вече се използва от друг тип стая.`,
    derivedNeedsParent: "Производната цена има нужда от основен ценови план.",
    pickType: "Изберете вид ограничение.",
    pickRange: "Изберете период.",
    endBeforeStart: "Крайната дата е преди началната.",
    selectRoom: "Изберете поне един тип стая.",
    noDatesMatch: "Няма дати, които да съвпадат с тези дни от седмицата.",
    selectManualPlan: "Изберете поне един ръчен ценови план (производните следват основния си план).",
    selectManualPlanForPrice: "Изберете поне един ръчен ценови план за промяната на цената (производните следват основния си план).",
    enterPrice: "Въведете стойност за цената.",
    unknownUpdate: "Непознат вид промяна.",
    nothingToUpdate: "Задайте поне едно поле за промяна.",
    planNotFound: "Ценовият план не е намерен.",
    planGone: "Този ценови план вече не съществува.",
    chooseParent: "Изберете основен ценови план.",
    selfParent: "Ценови план не може да бъде производен от самия себе си.",
    parentNotFound: "Основният ценови план не е намерен.",
    loop: "Така ще се получи кръг — план не може да е производен от свой собствен производен план.",
    tooDeep: (m) => `Веригата от производни планове е ограничена до ${m} нива — свържете към план, по-близо до основната цена.`,
    mustTraceToManual: "Производната цена трябва в крайна сметка да идва от ръчна основна цена.",
    roomNotFound: "Типът стая не е намерен.",
    roomGone: "Този тип стая вече не съществува — някой го е премахнал, докато страницата е била отворена.",
    roomGoneMaybe: "Този тип стая вече не съществува — възможно е някой да го е премахнал, докато страницата е била отворена.",
    planDeleted: "Този ценови план вече не съществува — някой го е премахнал, докато страницата е била отворена.",
    ruleDeleted: "Това правило за ограничение вече не съществува — някой го е премахнал, докато страницата е била отворена.",
    nothingSelected: "Не е избрано нищо за изтриване. Презаредете страницата и опитайте отново.",
    unreadableDate: "Тази дата не може да бъде прочетена. Презаредете календара и опитайте отново.",
    rowCannotPrice: "Този ред вече не може да има цена — планът може да е бил изключен или направен производен, докато страницата е била отворена. Презаредете календара.",
    noManualPlan: "Обектът още няма активен ръчен ценови план, така че няма какво да се цени. Добавете такъв в „Стаи и цени“.",
    badPrice: "Тази цена не е число, което може да се използва. Въведете сума от нула нагоре.",
    overPhysical: (v, r) => `${v} за продажба надвишава физическия брой за ${r} — запазено е, но проверете числото.`,
    skippedOccupancy: (room, c) => `${room} не е за ${c.join(" или ")} ${c.length === 1 && c[0] === 1 ? "гост" : "гости"} — ${c.length === 1 ? "този брой гости е пропуснат" : "тези бройки гости са пропуснати"} за нея.`,
    unpriced: (x) => `${x === 1 ? "1 цена нямаше" : `${x} цени нямаха`} от какво да се изчислят — процентът има нужда от съществуваща цена. Първо задайте цена.`,
    noPlanLinked: (names, x) => `Не е записана цена за ${names} — нито един от избраните ценови планове не е свързан с ${x === 1 ? "тази стая" : "тези стаи"}.`,
    past: (label, d, e) => `${label ? `${label} (${d})` : d} вече е минала. Най-ранната дата, която можете да изберете, е ${e}.`,
    startDate: "Началната дата",
    endDate: "Крайната дата",
    problems: {
      "no-primary": () => "Няма зададен основен брой гости. Един трябва да е основен — неговата цена се показва по подразбиране и за него важат ограниченията.",
      "many-primaries": (p) => `Повече от един брой гости е отбелязан като основен (${p.occupancies.join(", ")}). Може да е само един.`,
      "per-room-extra-rows": (p) => `Планът на стая има една цена, а тук са ${p.count}. Превключете плана на цена на човек или премахнете излишните редове.`,
      "per-room-wrong-occupancy": (p) => `Цената на стая покрива цялата стая, затова е за ${n(p.expected, "гост", "гости")}, а не за ${p.found}.`,
      gap: (p) => `Няма цена за ${p.missing.length === 1 ? "" : "тези бройки гости: "}${p.missing.join(", ")}. Планът на човек има нужда от цена за всеки брой до максимума на стаята, иначе не може да оферира такава резервация.`,
      duplicate: (p) => `Зададени са две цени за ${n(p.occupancy, "гост", "гости")}.`,
      "above-ceiling": (p) => `${n(p.occupancy, "гост", "гости")} са повече, отколкото побира стаята (${p.ceiling}).`,
      "below-one": () => "Не може да се зададе цена за по-малко от един гост.",
      "derived-without-rule": (p) => `Цената за ${n(p.occupancy, "гост", "гости")} е зададена да се изчислява, но не е посочено как.`,
      "primary-derived": () => "Основният брой гости не може да се изчислява от самия себе си — задайте му цена.",
    },
    cm: {
      priceUnreadable: "Тази цена не е число, което можем да прочетем. Въведете сума или изчистете клетката, за да остане без цена.",
      rowNotLinked: "Този ред не е свързан с ценови план, който може да има цена. Презаредете календара — ако продължава, проверете дали планът е още активен в „Стаи и цени“.",
      noPriceWritten: (b) => `Не е записана цена — нито един от избраните ценови планове не може да има цена.${b} Изберете ръчен, активен план (производните следват основния си план).`,
      droppedWhy: { inactive: "неактивен", derived: "производен — следва основния си план", elsewhere: "не е към този обект" },
      droppedIs: (p, w) => `${p} е ${w}`,
      droppedNote: (l) => `Не е записана цена за ${l}.`,
      noPlanSold: (r, x) => `${r} ${x === 1 ? "не получи" : "не получиха"} цена — нито един от избраните ценови планове не се продава за ${x === 1 ? "нея" : "тях"}.`,
      nothingToApply: "Няма нищо за прилагане.",
      changeN: (i, e) => `Промяна ${i}: ${e}`,
      simulate: {
        fill: "Попълнете канал, стая, цена и дата.",
        notConnected: "Този канал не е свързан с този обект.",
        demoOnly: "Симулираните резервации работят само с демо канали.",
        notMapped: (c) => `Тази стая и цена не са свързани с ${c}, така че каналът не би могъл да ги продаде. Първо ги свържете в „Съответствия“.`,
        noPrice: "Този ценови план няма цена за тези нощувки и няма цена по подразбиране, така че никой канал не го продава.",
        notImported: "Резервацията не можа да бъде внесена.",
        failedImport: "Каналът изпрати резервацията, но тя не можа да бъде внесена — вижте „Синхронизация“.",
      },
      reservation: {
        gone: "Тази резервация вече не съществува — възможно е някой да я е премахнал, докато страницата е била отворена.",
        alreadyCancelled: "Тази резервация вече е анулирана.",
        inHouse: "Гостът вече е настанен. Отпишете го в RevioPMS, за да приключи престоят — анулирането би пуснало заета стая отново в продажба.",
      },
    },
  },
};

