import type { Translations } from "@revio/ui/i18n";

/** Configuration — the property's taxes, invoicing, housekeeping, end-of-day and deposit rules. */
export interface ConfigurationStrings {
  lockedTitle: string;
  lockedBody: string;
  title: string;
  subtitle: (property: string) => string;
  taxes: {
    title: string;
    subtitle: string;
    vatStandard: string;
    vatReduced: string;
    accommodation: string;
    touristTax: string;
    touristTaxAside: string;
    touristTaxPlaceholder: string;
    touristTaxHint: string;
    beds: string;
    bedsAside: string;
    bedsHint: (suggested: number) => string;
    cityTax: string;
    payableOnSpot: string;
    included: string;
  };
  issuer: { title: string; subtitle: string; legalName: string; vatId: string; vatIdPlaceholder: string; address: string };
  housekeeping: {
    title: string;
    subtitle: string;
    inspectionLead: string;
    inspectionBefore: string;
    pendingInspection: string;
    inspectionAfter: string;
    autoAssignLead: string;
    autoAssignBody: string;
  };
  endOfDay: {
    title: string;
    subtitle: string;
    remindAfter: string;
    remindHint: string;
    closeAfter: string;
    closeHint: string;
    autoCloseLead: string;
    autoCloseBody: string;
  };
  compliance: {
    title: string;
    subtitle: string;
    jurisdiction: string;
    generic: string;
    bulgaria: string;
    eu: string;
    fiscalization: string;
    eInvoicing: string;
    note: string;
  };
  save: string;
  deposits: {
    title: string;
    subtitle: string;
    held: string;
    applied: string;
    vatWhen: string;
    vatAtUse: string;
    vatAtCapture: string;
    active: string;
    save: string;
    delete: string;
    newPlaceholder: string;
    add: string;
  };
  series: { title: string; subtitle: string; next: (n: string) => string };
  outlets: { title: string; subtitle: string; manage: string };
  /** The section nav: one section per thing a manager comes here to set. */
  nav: {
    aria: string;
    elsewhere: string;
    sections: Record<ConfigSectionKey, { label: string; blurb: string }>;
    links: Record<"catalog" | "rooms" | "staff" | "settings", { label: string; blurb: string }>;
  };
}

export type ConfigSectionKey = "taxes" | "invoices" | "deposits" | "housekeeping" | "endOfDay" | "compliance" | "outlets";

export const configuration: Translations<ConfigurationStrings> = {
  en: {
    lockedTitle: "Configuration is manager-only",
    lockedBody: "Ask an Owner, Admin or Manager to change tax, invoicing and deposit settings.",
    title: "Configuration",
    subtitle: (p) => `${p} · taxes, invoicing, housekeeping and outlets`,
    taxes: {
      title: "Taxes & VAT",
      subtitle: "Shared with the CRS tax setup; the invoice-specific rates live here",
      vatStandard: "Standard VAT %",
      vatReduced: "Reduced VAT %",
      accommodation: "(accommodation)",
      touristTax: "Tourist tax per night",
      touristTaxAside: "(туристически данък)",
      touristTaxPlaceholder: "e.g. 1.00",
      touristTaxHint: "The rate your municipal council set, per night.",
      beds: "Declared beds",
      bedsAside: "(легла)",
      bedsHint: (n) => `For the 30% annual minimum. Your rooms suggest ${n} — confirm what you declared.`,
      cityTax: "City tax",
      payableOnSpot: "Payable on spot — posts as a folio fee",
      included: "Included in the rate — suppressed on the folio",
    },
    issuer: {
      title: "Invoice issuer",
      subtitle: "Your legal identity on the tax document (falls back to the property name/address)",
      legalName: "Legal name",
      vatId: "VAT ID",
      vatIdPlaceholder: "e.g. BG123456789",
      address: "Address",
    },
    housekeeping: {
      title: "Housekeeping & assignment",
      subtitle: "Whether cleaned rooms need inspecting, and how rooms get assigned",
      inspectionLead: "Require inspection before a room is sellable.",
      inspectionBefore: "On: a cleaned room is",
      pendingInspection: "pending inspection",
      inspectionAfter: "and can’t be assigned until a supervisor marks it Inspected. Off: cleaned counts as ready.",
      autoAssignLead: "Auto-assign physical rooms the evening before.",
      autoAssignBody: "Off by default — \"Suggest a room\" works either way. When on, the evening pass assigns late and pins manual overrides so a later run never reshuffles them.",
    },
    endOfDay: {
      title: "End of day",
      subtitle: "When an unclosed day is chased, and when it closes itself",
      remindAfter: "Remind after (minutes past midnight)",
      remindHint: "30 = 00:30 the following day.",
      closeAfter: "Then close automatically after (hours)",
      closeHint: "22 hours after the reminder, so ≈22:30 the next day.",
      autoCloseLead: "Close the day automatically if nobody does.",
      autoCloseBody: "An automatic close is a real close — it marks no-shows, accrues the night’s extras and rolls the date — and is recorded as having had no person in it. Switch it off and unclosed days will accumulate until somebody closes each one.",
    },
    compliance: {
      title: "Compliance pack",
      subtitle: "Fiscalization and e-invoicing rules for your country",
      jurisdiction: "Jurisdiction",
      generic: "Generic (EU)",
      bulgaria: "Bulgaria",
      eu: "EU (structured e-invoicing)",
      fiscalization: "Real-time fiscalization (BG N-18) — routes receipts through a certified provider",
      eInvoicing: "Structured e-invoicing (EN 16931 / Peppol) for B2B",
      note: "The boundary is built (F3); flipping these on connects the certified provider — the invoice/receipt core stays generic.",
    },
    save: "Save changes",
    deposits: {
      title: "Deposit types",
      subtitle: "A deposit is money you hold, not money you have earned — set when each type becomes revenue",
      held: "Held",
      applied: "Applied",
      vatWhen: "When VAT applies",
      vatAtUse: "VAT at use",
      vatAtCapture: "VAT at capture",
      active: "Active",
      save: "Save",
      delete: "Delete",
      newPlaceholder: "New type (e.g. Damage)",
      add: "Add type",
    },
    series: {
      title: "Invoice series",
      subtitle: "Gapless numbering — invoices and credit notes share one range",
      next: (n) => `next ${n}`,
    },
    outlets: { title: "Outlets", subtitle: "Charge sources & their catalogs", manage: "Manage catalog →" },
    nav: {
      aria: "Configuration sections",
      elsewhere: "Elsewhere",
      sections: {
        taxes: { label: "Taxes", blurb: "VAT, tourist tax and how the city tax is shown" },
        invoices: { label: "Invoices", blurb: "Your legal identity on invoices, and the numbering" },
        deposits: { label: "Deposits", blurb: "Deposit types and when each becomes revenue" },
        housekeeping: { label: "Housekeeping", blurb: "Inspection before sale, and room assignment" },
        endOfDay: { label: "End of day", blurb: "When an unclosed day is chased, and closed" },
        compliance: { label: "Compliance", blurb: "Fiscalization and e-invoicing for your country" },
        outlets: { label: "Outlets", blurb: "Where charges come from" },
      },
      links: {
        catalog: { label: "Extras catalog", blurb: "What each outlet sells, and its price" },
        rooms: { label: "Rooms & floors", blurb: "The physical rooms and their floors" },
        staff: { label: "Staff & access", blurb: "Who works here, and what they may open" },
        settings: { label: "Settings", blurb: "Property, guest emails, billing" },
      },
    },
  },
  bg: {
    lockedTitle: "Конфигурацията е само за управители",
    lockedBody: "Помолете собственик, администратор или управител да промени данъците, фактурирането и депозитите.",
    title: "Конфигурация",
    subtitle: (p) => `${p} · данъци, фактуриране, хаускийпинг и точки на продажба`,
    taxes: {
      title: "Данъци и ДДС",
      subtitle: "Общи с данъчните настройки в RevioCRS; ставките за фактурите се задават тук",
      vatStandard: "Основна ставка ДДС %",
      vatReduced: "Намалена ставка ДДС %",
      accommodation: "(настаняване)",
      touristTax: "Туристически данък на нощувка",
      touristTaxAside: "(определя го общината)",
      touristTaxPlaceholder: "напр. 1,00",
      touristTaxHint: "Ставката, определена от общинския съвет, на нощувка.",
      beds: "Декларирани легла",
      bedsAside: "(по категоризация)",
      bedsHint: (n) => `За годишния минимум от 30%. По стаите Ви излизат ${n} — потвърдете какво сте декларирали.`,
      cityTax: "Туристически данък в сметката",
      payableOnSpot: "Плаща се на място — начислява се като такса в сметката",
      included: "Включен в цената — не се показва в сметката",
    },
    issuer: {
      title: "Издател на фактури",
      subtitle: "Юридическото Ви лице върху данъчния документ (ако е празно — името и адресът на обекта)",
      legalName: "Юридическо наименование",
      vatId: "ДДС номер",
      vatIdPlaceholder: "напр. BG123456789",
      address: "Адрес",
    },
    housekeeping: {
      title: "Хаускийпинг и разпределение",
      subtitle: "Дали почистените стаи се нуждаят от проверка и как се разпределят стаите",
      inspectionLead: "Изисквай проверка, преди стаята да може да се продаде.",
      inspectionBefore: "Включено: почистената стая е",
      pendingInspection: "в очакване на проверка",
      inspectionAfter: "и не може да бъде дадена, докато старши хаускийпинг не я отбележи като проверена. Изключено: почистена означава готова.",
      autoAssignLead: "Автоматично разпределяй физическите стаи вечерта преди пристигането.",
      autoAssignBody: "По подразбиране е изключено — „Предложи стая“ работи и така. Когато е включено, вечерното разпределение дава стаите възможно най-късно и фиксира ръчните избори, така че по-късно изпълнение никога да не ги разбърква.",
    },
    endOfDay: {
      title: "Край на деня",
      subtitle: "Кога се напомня за незатворен ден и кога той се затваря сам",
      remindAfter: "Напомни след (минути след полунощ)",
      remindHint: "30 = 00:30 на следващия ден.",
      closeAfter: "След това затвори автоматично след (часа)",
      closeHint: "22 часа след напомнянето, т.е. ≈22:30 на следващия ден.",
      autoCloseLead: "Затваряй деня автоматично, ако никой не го направи.",
      autoCloseBody: "Автоматичното затваряне е истинско затваряне — отбелязва неявилите се, начислява екстрите за нощта и сменя работната дата — и се записва като направено без участието на човек. Ако го изключите, незатворените дни ще се трупат, докато някой не затвори всеки от тях.",
    },
    compliance: {
      title: "Нормативни изисквания",
      subtitle: "Правилата за фискализация и електронни фактури във Вашата държава",
      jurisdiction: "Юрисдикция",
      generic: "Обща (ЕС)",
      bulgaria: "България",
      eu: "ЕС (структурирани е-фактури)",
      fiscalization: "Фискализация в реално време (Наредба Н-18) — касовите бележки минават през сертифициран доставчик",
      eInvoicing: "Структурирани електронни фактури (EN 16931 / Peppol) за B2B",
      note: "Връзката е изградена; включването на тези опции свързва сертифицирания доставчик — ядрото за фактури и бележки остава общо.",
    },
    save: "Запази промените",
    deposits: {
      title: "Видове депозити",
      subtitle: "Депозитът е пари, които държите, а не пари, които сте спечелили — задайте кога всеки вид става приход",
      held: "Задържан",
      applied: "Приспаднат",
      vatWhen: "Кога се начислява ДДС",
      vatAtUse: "ДДС при използване",
      vatAtCapture: "ДДС при получаване",
      active: "Активен",
      save: "Запази",
      delete: "Изтрий",
      newPlaceholder: "Нов вид (напр. Щети)",
      add: "Добави вид",
    },
    series: {
      title: "Номерация на фактурите",
      subtitle: "Без пропуски — фактурите и кредитните известия споделят един диапазон",
      next: (n) => `следващ № ${n}`,
    },
    outlets: { title: "Точки на продажба", subtitle: "Източници на начисления и техните каталози", manage: "Управление на каталога →" },
    nav: {
      aria: "Раздели на конфигурацията",
      elsewhere: "На друго място",
      sections: {
        taxes: { label: "Данъци", blurb: "ДДС, туристически данък и как се показва" },
        invoices: { label: "Фактури", blurb: "Вашите данни във фактурите и номерацията" },
        deposits: { label: "Депозити", blurb: "Видове депозити и кога стават приход" },
        housekeeping: { label: "Хаускийпинг", blurb: "Проверка преди продажба и разпределяне на стаи" },
        endOfDay: { label: "Край на деня", blurb: "Кога незатвореният ден се напомня и затваря" },
        compliance: { label: "Съответствие", blurb: "Фискализация и е-фактури за Вашата държава" },
        outlets: { label: "Точки на продажба", blurb: "Откъде идват таксите" },
      },
      links: {
        catalog: { label: "Каталог с екстри", blurb: "Какво продава всяка точка и на каква цена" },
        rooms: { label: "Стаи и етажи", blurb: "Физическите стаи и техните етажи" },
        staff: { label: "Персонал и достъп", blurb: "Кой работи тук и какво може да отваря" },
        settings: { label: "Настройки", blurb: "Обект, имейли до гостите, абонамент" },
      },
    },
  },
};
