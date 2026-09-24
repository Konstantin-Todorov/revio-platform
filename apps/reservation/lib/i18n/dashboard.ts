import type { Translations } from "@revio/ui/i18n";

/**
 * The RevioCRS Dashboard — KPI cards, the trend, source mix, Action Center, forecast, today's
 * arrivals. `view` and `trend` are read by client components (strings and pure functions only).
 */
export interface DashboardStrings {
  title: string;
  reports: string;
  setupPromise: string;
  /** Keyed by core's step key; `welcome-drift.test.ts` holds the English to core's own wording. */
  setupSteps: Record<string, { title: string; body: string; cta: string }>;
  kpi: {
    occupancy: string;
    committedOccupancy: string;
    occupancySub: (sold: number, available: number) => string;
    sold: string;
    soldOtb: string;
    soldSub: string;
    available: string;
    availableSub: string;
    revenue: (basis: string) => string;
    revenueOtb: (basis: string) => string;
    revenueSub: string;
    adr: string;
    adrSub: string;
    revpar: string;
    revparSub: string;
    cancellation: string;
    cancellationSub: (cancelled: number, created: number) => string;
    pickup: string;
    pickupVs: (date: string) => string;
    pickupBaseline: string;
  };
  /** The hotel's revenue basis, by code. */
  revenueBasis: Record<string, string>;
  view: {
    comparedWith: string;
    lastYear: string;
    lastWeek: string;
    customize: string;
    periodPresets: string;
    kpiCards: string;
    savedOnDevice: string;
    hintLw: string;
    hintYoy: string;
  };
  trend: {
    title: string;
    fallback: string;
    days: (n: number) => string;
    firstShown: string;
    notEnough: string;
    occupancyPct: string;
    revenue: (basis: string) => string;
    isolate: string;
    occupancyAt: (pct: string) => string;
    revenueAt: (amount: string) => string;
    aria: (n: number) => string;
  };
  sourceMix: {
    title: string;
    subtitle: string;
    empty: string;
    revenue: string;
    noCommission: string;
    rateNotSet: string;
    commission: (pct: string) => string;
    bySource: (total: string) => string;
    noRevenue: string;
  };
  portfolio: { lead: string; body: (count: number) => string; autoSelects: string; switchTo: string };
  actions: {
    title: string;
    empty: string;
    thresholds: (n: number) => string;
    overbooked: (room: string, n: number, date: string) => string;
    soldOut: (room: string, date: string) => string;
    low: (room: string, n: number, date: string) => string;
    failedSyncs: (n: number) => string;
    openErrors: (n: number) => string;
  };
  forecast: {
    title: string;
    window: string;
    occupancy: string;
    roomNights: string;
    revenue: string;
    arrivals: string;
    departures: string;
    next: (n: number) => string;
    disclaimer: string;
  };
  today: { title: (arrivals: number, departures: number) => string; empty: string };
  recent: { title: string; all: string; empty: string; new: string; cancelled: string };
  footer: {
    avgStay: (nights: string) => string;
    avgLead: (days: string) => string;
    noShowsExcluded: string;
    noShowsCount: string;
    calendar: string;
  };
}

export const dashboard: Translations<DashboardStrings> = {
  en: {
    title: "Dashboard",
    reports: "Reports",
    setupPromise: "Four steps and you can take, price and invoice a booking.",
    setupSteps: {
      property: { title: "Your property is set up", body: "Created with your account, along with a starting rate plan.", cta: "Review" },
      "room-types": { title: "Add your room types", body: "The rooms you sell and how many of each — the basis of every availability check.", cta: "Add room types" },
      rates: { title: "Set your rates", body: "Price your dates so the availability search can quote a stay.", cta: "Set rates" },
      taxes: { title: "Add your taxes & fees", body: "VAT, city tax and any fixed fees, so every quote and folio totals correctly.", cta: "Open settings" },
      "first-reservation": { title: "Take your first reservation", body: "Search availability, hold the room, confirm — the whole booking flow in one screen.", cta: "New reservation" },
    },
    kpi: {
      occupancy: "Occupancy",
      committedOccupancy: "Committed occupancy",
      occupancySub: (sold, available) => `${sold} of ${available} room-nights`,
      sold: "Rooms sold",
      soldOtb: "Rooms on the books",
      soldSub: "room-nights in range",
      available: "Rooms available",
      availableSub: "physical − OOO − closed",
      revenue: (basis) => `Room revenue (${basis})`,
      revenueOtb: (basis) => `Revenue on the books (${basis})`,
      revenueSub: "accommodation only",
      adr: "ADR",
      adrSub: "revenue ÷ rooms sold",
      revpar: "RevPAR",
      revparSub: "the #1 hotel KPI",
      cancellation: "Cancellation rate",
      cancellationSub: (cancelled, created) => `${cancelled} of ${created} created`,
      pickup: "Pickup · 30d",
      pickupVs: (date) => `room-nights vs ${date}`,
      pickupBaseline: "baseline recorded today",
    },
    revenueBasis: { gross: "gross", net: "net" },
    view: {
      comparedWith: "Compared with",
      lastYear: "Last year",
      lastWeek: "Last week",
      customize: "Customize view",
      periodPresets: "Period presets",
      kpiCards: "KPI cards",
      savedOnDevice: "Saved on this device, per user.",
      hintLw: "vs last week (7 days back — same weekday)",
      hintYoy: "vs same time last year (364 days back — same weekday)",
    },
    trend: {
      title: "Occupancy & revenue by day",
      fallback: "Last 28 days — pick a multi-day range above to match the KPIs",
      days: (n) => `${n} days`,
      firstShown: " (first 62 shown)",
      notEnough: "Not enough days in this range to draw a trend.",
      occupancyPct: "Occupancy %",
      revenue: (basis) => `Revenue (${basis})`,
      isolate: "click a legend to isolate",
      occupancyAt: (pct) => `Occupancy ${pct}%`,
      revenueAt: (amount) => `Revenue ${amount}`,
      aria: (n) => `Occupancy and revenue over ${n} days`,
    },
    sourceMix: {
      title: "Source mix",
      subtitle: "Revenue share, and what each channel costs you",
      empty: "No sold reservations in this range yet.",
      revenue: "revenue",
      noCommission: "no commission",
      rateNotSet: "rate not set",
      commission: (pct) => `${pct}% commission`,
      bySource: (total) => `${total} by source`,
      noRevenue: "No revenue in this period.",
    },
    portfolio: {
      lead: "Portfolio view.",
      body: (count) => `KPIs, charts, source mix and forecast above sum across all ${count} properties (ratios recomputed from combined totals). The operational lists below auto-select`,
      autoSelects: "",
      switchTo: "— switch to a single property to act on its arrivals, alerts and bookings.",
    },
    actions: {
      title: "Action Center",
      empty: "Nothing needs attention — no overbookings, sell-outs or sync failures.",
      thresholds: (n) => `Thresholds are Settings (low availability ≤ ${n}) — tune them under Settings → Rates & policies.`,
      overbooked: (room, n, date) => `${room} is OVERBOOKED by ${n} on ${date}`,
      soldOut: (room, date) => `${room} sells out on ${date}`,
      low: (room, n, date) => `${room}: only ${n} left on ${date}`,
      failedSyncs: (n) => `${n} failed sync${n === 1 ? "" : "s"} in the last 24h`,
      openErrors: (n) => `${n} unresolved error${n === 1 ? " needs" : "s need"} attention`,
    },
    forecast: {
      title: "Forecast — the same data read forward",
      window: "Window",
      occupancy: "Occupancy",
      roomNights: "Room-nights",
      revenue: "Revenue",
      arrivals: "Arrivals",
      departures: "Departures",
      next: (n) => `Next ${n} days`,
      disclaimer: "Expected values from confirmed bookings — not a prediction model. New pickup raises these; cancellations lower them.",
    },
    today: {
      title: (a, d) => `Arrivals today (${a}) · Departures today (${d})`,
      empty: "No arrivals or departures today.",
    },
    recent: {
      title: "New & cancelled · last 24h",
      all: "All reservations",
      empty: "No booking activity in the last 24 hours.",
      new: "new",
      cancelled: "cancelled",
    },
    footer: {
      avgStay: (n) => `Avg length of stay ${n} nights`,
      avgLead: (n) => `avg lead time ${n} days`,
      noShowsExcluded: "no-shows excluded from sold",
      noShowsCount: "no-shows count as sold",
      calendar: "Inventory Calendar",
    },
  },
  bg: {
    title: "Табло",
    reports: "Отчети",
    setupPromise: "Четири стъпки и можете да приемате, оценявате и фактурирате резервации.",
    setupSteps: {
      property: { title: "Обектът Ви е създаден", body: "Създаден е заедно с профила Ви, с начален ценови план.", cta: "Преглед" },
      "room-types": { title: "Добавете типовете стаи", body: "Стаите, които продавате, и колко от всяка имате — основата на всяка проверка за наличност.", cta: "Добави типове стаи" },
      rates: { title: "Задайте цените", body: "Оценете датите си, за да може търсенето на наличност да предложи цена за престой.", cta: "Задай цени" },
      taxes: { title: "Добавете данъци и такси", body: "ДДС, туристически данък и фиксирани такси, за да излиза всяка оферта и сметка точно.", cta: "Към настройките" },
      "first-reservation": { title: "Направете първата си резервация", body: "Търсене на наличност, задържане на стаята, потвърждение — целият процес на един екран.", cta: "Нова резервация" },
    },
    kpi: {
      occupancy: "Заетост",
      committedOccupancy: "Потвърдена заетост",
      occupancySub: (sold, available) => `${sold} от ${available} нощувки`,
      sold: "Продадени нощувки",
      soldOtb: "Потвърдени нощувки",
      soldSub: "нощувки в периода",
      available: "Налични стаи",
      availableSub: "физически − неизправни − затворени",
      revenue: (basis) => `Приходи от нощувки (${basis})`,
      revenueOtb: (basis) => `Потвърдени приходи (${basis})`,
      revenueSub: "само нощувки",
      adr: "ADR",
      adrSub: "приходи ÷ продадени нощувки",
      revpar: "RevPAR",
      revparSub: "основният хотелски показател",
      cancellation: "Дял на анулациите",
      cancellationSub: (cancelled, created) => `${cancelled} от ${created} създадени`,
      pickup: "Прираст · 30 дни",
      pickupVs: (date) => `нощувки спрямо ${date}`,
      pickupBaseline: "началната точка е записана днес",
    },
    revenueBasis: { gross: "бруто", net: "нето" },
    view: {
      comparedWith: "Сравнение с",
      lastYear: "Миналата година",
      lastWeek: "Миналата седмица",
      customize: "Настройка на изгледа",
      periodPresets: "Периоди",
      kpiCards: "Показатели",
      savedOnDevice: "Запазва се на това устройство, за всеки потребител.",
      hintLw: "спрямо миналата седмица (7 дни назад — същия ден от седмицата)",
      hintYoy: "спрямо същия период миналата година (364 дни назад — същия ден от седмицата)",
    },
    trend: {
      title: "Заетост и приходи по дни",
      fallback: "Последните 28 дни — изберете период от няколко дни горе, за да съвпада с показателите",
      days: (n) => `${n} дни`,
      firstShown: " (показани са първите 62)",
      notEnough: "Периодът е твърде кратък, за да се начертае тенденция.",
      occupancyPct: "Заетост %",
      revenue: (basis) => `Приходи (${basis})`,
      isolate: "натиснете легендата, за да покажете само нея",
      occupancyAt: (pct) => `Заетост ${pct}%`,
      revenueAt: (amount) => `Приходи ${amount}`,
      aria: (n) => `Заетост и приходи за ${n} дни`,
    },
    sourceMix: {
      title: "Източници",
      subtitle: "Дял от приходите и колко Ви струва всеки канал",
      empty: "Все още няма продадени резервации в този период.",
      revenue: "приходи",
      noCommission: "без комисиона",
      rateNotSet: "комисионата не е зададена",
      commission: (pct) => `${pct}% комисиона`,
      bySource: (total) => `${total} по източници`,
      noRevenue: "Няма приходи в този период.",
    },
    portfolio: {
      lead: "Изглед за групата.",
      body: (count) => `Показателите, графиките, източниците и прогнозата горе са сбор от всичките ${count} обекта (съотношенията са преизчислени от общите суми). Оперативните списъци долу избират автоматично`,
      autoSelects: "",
      switchTo: "— изберете отделен обект, за да работите с неговите пристигания, известия и резервации.",
    },
    actions: {
      title: "За действие",
      empty: "Нищо не изисква внимание — няма свръхрезервации, разпродадени дати или неуспешни синхронизации.",
      thresholds: (n) => `Праговете са в Настройки (ниска наличност ≤ ${n}) — променят се в Настройки → Цени и политики.`,
      overbooked: (room, n, date) => `${room} е СВРЪХРЕЗЕРВИРАНА с ${n} на ${date}`,
      soldOut: (room, date) => `${room} е разпродадена на ${date}`,
      low: (room, n, date) => `${room}: остават само ${n} на ${date}`,
      failedSyncs: (n) => `${n} ${n === 1 ? "неуспешна синхронизация" : "неуспешни синхронизации"} през последните 24 ч`,
      openErrors: (n) => `${n} ${n === 1 ? "нерешена грешка изисква" : "нерешени грешки изискват"} внимание`,
    },
    forecast: {
      title: "Прогноза — същите данни, гледани напред",
      window: "Период",
      occupancy: "Заетост",
      roomNights: "Нощувки",
      revenue: "Приходи",
      arrivals: "Пристигания",
      departures: "Напускания",
      next: (n) => `Следващите ${n} дни`,
      disclaimer: "Очаквани стойности от потвърдени резервации — не е модел за прогнозиране. Новите резервации ги увеличават, анулациите ги намаляват.",
    },
    today: {
      title: (a, d) => `Пристигания днес (${a}) · Напускания днес (${d})`,
      empty: "Днес няма пристигания или напускания.",
    },
    recent: {
      title: "Нови и анулирани · последните 24 ч",
      all: "Всички резервации",
      empty: "Няма нови резервации през последните 24 часа.",
      new: "нова",
      cancelled: "анулирана",
    },
    footer: {
      avgStay: (n) => `Среден престой ${n} нощувки`,
      avgLead: (n) => `средно ${n} дни предварително`,
      noShowsExcluded: "неявилите се не се броят за продадени",
      noShowsCount: "неявилите се се броят за продадени",
      calendar: "Календар на наличността",
    },
  },
};
