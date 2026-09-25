import type { Translations } from "@revio/ui/i18n";

/**
 * Analytics — the seven report tabs and the charts they are drawn with.
 *
 * Occupancy is „заетост“, a room-night „нощувка“; ADR and RevPAR stay as the industry writes them,
 * the same as the Dashboard (`dashboard.ts`), so one number is named one way on both screens.
 * `cancelBasis` words core's `basisLabel` from `getCancellationReport`; `forecastDisclaimer` is the
 * Dashboard's sentence, word for word, on purpose.
 */
export interface ReportsStrings {
  title: string;
  subtitle: (scope: string) => string;
  exportExcel: string;
  csv: string;
  tabs: Record<"performance" | "pickup" | "source" | "products" | "cancellation" | "otb" | "availability", string>;
  stayDate: string;
  bookDate: string;
  lensHint: { book: string; stay: string };
  gran: { d: string; w: string; m: string };
  granAdj: { d: string; w: string; m: string };
  comparedWith: string;
  lastYear: string;
  lastWeek: string;
  portfolio: (n: number) => string;
  portfolioTail: string;
  portfolioAvailability: (property: string) => string;
  week: (monday: string) => string;
  revenueDisplay: { gross: string; net: string };
  perf: {
    occupancy: string; occupancyHint: string;
    adr: string; adrHint: string;
    revpar: string; revparHint: string;
    revenue: (display: string) => string; revenueHint: (display: string) => string;
    roomNights: string; roomNightsHint: string;
    prior: (v: string) => string;
    evolution: (range: string, gran: string) => string;
    evolutionSub: (cmp: string) => string;
    multiDay: string;
    byRoomType: string;
    byRoomTypeSub: string;
    noSold: string;
    nightsAdr: (nights: number, adr: string) => string;
    detailed: (gran: string) => string;
    cols: { date: string; week: string; month: string; available: string; sold: string; occupancy: string; revenue: string; adr: string; revpar: string };
  };
  production: {
    title: (range: string, bookings: number, nights: number, revenue: string, cancelled: number) => string;
    cols: { bookedOn: string; bookings: string; nights: string; revenue: string; cancelled: string };
    empty: string;
  };
  products: {
    byRoom: (range: string) => string;
    byPlan: (range: string) => string;
    basisBook: string;
    basisStay: string;
  };
  otb: {
    next: (n: number) => string;
    occupancy: string;
    revenue: string;
    nights: string;
    arrivals: string;
    title: string;
    allInWeek: string;
    perArrival: (days: number) => string;
    unit: string;
    disclaimer: string;
  };
  pickup: {
    title: string;
    against: (date: string, gained: number, lost: number) => string;
    first: string;
    footnote: string;
    soldNow: string;
    atSnapshot: string;
    pickup: string;
    needsTwo: string;
  };
  source: {
    costTitle: (range: string) => string;
    paid: string;
    noOta: string;
    rateNotSet: (amount: string) => string;
    ofOta: (pct: string, amount: string) => string;
    direct: string;
    directOf: (a: string, b: string) => string;
    avoided: string;
    estimate: string;
    ifDirect: (pct: string) => string;
    setRate: string;
    needsOta: string;
    paidIsActual: string;
    paidIsActualTail: string;
    avoidedIsEstimate: string;
    avoidedTail: string;
    keptHidden: (amount: string) => string;
    kept: string;
    mixTitle: (range: string) => string;
    mixSub: string;
    totalRevenue: string;
    noCommission: string;
    rateMissing: string;
    commission: (pct: number) => string;
    whatYouKeep: string;
    noRevenue: string;
    realLower: string;
    keepsAll: (nights: number) => string;
    minus: (nights: number, amount: string) => string;
    byName: (centre: string) => string;
  };
  cancel: {
    title: (range: string) => string;
    counted: (lens: "book" | "stay", basis: string) => string;
    basis: (lens: "book" | "stay", n: number) => string;
    ofReservations: string;
    gaugeAria: (pct: string) => string;
    ofScale: (a: number, b: number) => string;
    ofRoomNights: string;
    nightsOf: (a: number, b: number) => string;
    bySource: string;
    direct: string;
    none: string;
    listLead: string;
    listLink: string;
    listTail: string;
  };
  avail: {
    title: (from: string, to: string) => string;
    sub: string;
    roomType: string;
    rooms: (n: number) => string;
    cellTitle: (date: string, left: number, of: number) => string;
    overbooked: string;
    under: (pct: number) => string;
    footnote: string;
  };
  chart: {
    roomNights: string;
    adr: (currency: string) => string;
    adrShort: string;
    withBasis: (what: string, basis: string) => string;
    nothingPeriod: string;
    noRevenuePeriod: string;
    nothingOnBooks: string;
    nothingCommitted: string;
  };
}

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const reports: Translations<ReportsStrings> = {
  en: {
    title: "Analytics",
    subtitle: (sc) => `${sc} · occupancy, rate and revenue for the period you choose`,
    exportExcel: "Export Excel",
    csv: "CSV",
    tabs: {
      performance: "Performance", pickup: "Pickup & Pace", source: "Source / Channel mix", products: "Room-type & Rate-plan",
      cancellation: "Cancellations", otb: "On-the-books", availability: "Availability",
    },
    stayDate: "Stay date",
    bookDate: "Book date",
    lensHint: { book: "production — when it was booked", stay: "occupancy — when the stay falls" },
    gran: { d: "Daily", w: "Weekly", m: "Monthly" },
    granAdj: { d: "daily", w: "weekly", m: "monthly" },
    comparedWith: "Compared with",
    lastYear: "Last year",
    lastWeek: "Last week",
    portfolio: (n) => `Portfolio totals across ${n} properties.`,
    portfolioTail: " Occupancy, ADR and RevPAR are recomputed from combined room-nights and revenue — never averaged.",
    portfolioAvailability: (p) => ` The Availability calendar shows ${p} only (room types differ per property).`,
    week: (m) => `wk ${m}`,
    revenueDisplay: { gross: "gross", net: "net" },
    perf: {
      occupancy: "Occupancy", occupancyHint: "Room-nights sold ÷ room-nights available, for the period. Δ shown in percentage points vs the comparison basis.",
      adr: "ADR", adrHint: "Average Daily Rate = room revenue ÷ room-nights sold. Recomputed Σ/Σ across the period, not an average of daily ADRs.",
      revpar: "RevPAR", revparHint: "Revenue Per Available Room = room revenue ÷ room-nights available (= ADR × occupancy). The truest single yield metric.",
      revenue: (d) => `Revenue (${d})`, revenueHint: (d) => `Room revenue for the period (${d}). Gross = as sold; Net subtracts channel commission — toggled in Settings.`,
      roomNights: "Room-nights", roomNightsHint: "Total room-nights sold in the period — the volume behind ADR and occupancy.",
      prior: (v) => `${v} prior`,
      evolution: (r, g) => `Evolution · ${r} · ${g}`,
      evolutionSub: (c) => `Room-nights (bars) and ADR (lines) — this period vs ${c.toLowerCase()}`,
      multiDay: "Pick a multi-day range to see the trend.",
      byRoomType: "Performance by room type",
      byRoomTypeSub: "Revenue per type — room-nights and ADR on each bar",
      noSold: "No sold nights in this range.",
      nightsAdr: (n, a) => `${n} nights · ADR ${a}`,
      detailed: (g) => `Detailed ${g} data — the numbers behind the charts`,
      cols: { date: "Date", week: "Week", month: "Month", available: "Available", sold: "Sold", occupancy: "Occupancy", revenue: "Revenue", adr: "ADR", revpar: "RevPAR" },
    },
    production: {
      title: (r, b, n, rev, c) => `Production · ${r} · ${b} bookings made · ${n} room-nights · ${rev} booked (${c} since cancelled)`,
      cols: { bookedOn: "Booked on", bookings: "Bookings", nights: "Room-nights", revenue: "Revenue booked", cancelled: "Since cancelled" },
      empty: "Nothing was booked in this range.",
    },
    products: {
      byRoom: (r) => `By room type · ${r}`,
      byPlan: (r) => `By rate plan · ${r}`,
      basisBook: "booked in range",
      basisStay: "stays in range",
    },
    otb: {
      next: (n) => `Next ${n} days — on the books`,
      occupancy: "committed occupancy",
      revenue: "revenue on the books",
      nights: "room-nights committed",
      arrivals: "arrivals / departures",
      title: "Committed demand · next 30 days",
      allInWeek: "Every committed night falls in the next 7 days — that is why the two cards below match",
      perArrival: (d) => `Room-nights already sold, per arrival date · ${d} day${d === 1 ? "" : "s"} with business`,
      unit: "Room-nights committed",
      disclaimer: "Expected values from confirmed bookings — not a prediction model. New pickup raises these; cancellations lower them.",
    },
    pickup: {
      title: "Pickup & Pace · next 30 days",
      against: (d, g, l) => `Against the ${d} snapshot · ${g} date${g === 1 ? "" : "s"} gained, ${l} lost`,
      first: "First snapshot recorded today — pace appears as history accumulates",
      footnote: "Shaded band is pickup since the snapshot. Day-by-day figures are in the CSV export.",
      soldNow: "Sold now",
      atSnapshot: "At snapshot",
      pickup: "Pickup",
      needsTwo: "Pace needs at least two days and one earlier snapshot to compare against.",
    },
    source: {
      costTitle: (r) => `Cost of distribution · ${r}`,
      paid: "Commission paid",
      noOta: "no OTA revenue in this period",
      rateNotSet: (a) => `${a} OTA revenue · commission rate not set`,
      ofOta: (p, a) => `${p} of ${a} OTA revenue`,
      direct: "Booked direct",
      directOf: (a, b) => `${a} of ${b} · no commission`,
      avoided: "Commission avoided",
      estimate: " · estimate",
      ifDirect: (p) => `if direct bookings had come through your channels at ${p}`,
      setRate: "set a commission rate on your channels and this becomes computable",
      needsOta: "needs OTA revenue in the period to have a rate to compare against",
      paidIsActual: "Commission paid is actual",
      paidIsActualTail: " — your channels’ own rates applied to the revenue they brought. ",
      avoidedIsEstimate: "Commission avoided is an estimate",
      avoidedTail: ": it assumes those direct guests would otherwise have booked through an OTA, which some would and some would not. ",
      keptHidden: (a) => `Revenue kept is not shown: ${a} of OTA revenue has no commission rate configured, so the real cost is unknown.`,
      kept: "Revenue kept after real commission: ",
      mixTitle: (r) => `Source mix · ${r}`,
      mixSub: "Where the business comes from, and what each channel actually nets",
      totalRevenue: "total revenue",
      noCommission: "no commission",
      rateMissing: "rate not set",
      commission: (p) => `${p}% commission`,
      whatYouKeep: "What you keep, after commission",
      noRevenue: "No revenue in this period.",
      realLower: "rate not set — real figure is lower",
      keepsAll: (n) => `${n} nights · keeps 100%`,
      minus: (n, a) => `${n} nights · −${a}`,
      byName: (c) => `${c} by source`,
    },
    cancel: {
      title: (r) => `Cancellations · ${r}`,
      counted: (l, b) => `Counted ${l === "book" ? "by booking date" : "by stay date"} — ${b}`,
      basis: (l, n) => l === "book"
        ? `of ${n} reservation${n === 1 ? "" : "s"} created in this period`
        : `of ${n} stay${n === 1 ? "" : "s"} falling in this period`,
      ofReservations: "of reservations",
      gaugeAria: (p) => `Cancellation rate ${p} of reservations`,
      ofScale: (a, b) => `${a} of ${b} · scale ends at 30%`,
      ofRoomNights: "of room-nights",
      nightsOf: (a, b) => `${a} of ${b} nights — the number that matters for revenue`,
      bySource: "By source",
      direct: "Direct",
      none: "No cancellations in this period.",
      listLead: "Which bookings cancelled is a list, so it lives where lists live — ",
      listLink: "Reservations, filtered to cancelled",
      listTail: ". Export CSV here carries the full detail.",
    },
    avail: {
      title: (f, t) => `Availability · ${f} → ${t} · remaining per room type`,
      sub: "Shaded by how much of each room type is still sellable — not by an absolute count",
      roomType: "Room type",
      rooms: (n) => `${n} rooms`,
      cellTitle: (d, l, o) => `${d} · ${l} of ${o} remaining`,
      overbooked: "overbooked",
      under: (p) => `under ${p}% left`,
      footnote: " — relative to each room type, so a small type is not flagged for having two of three free. Day-by-day detail is on the Inventory Calendar.",
    },
    chart: {
      roomNights: "Room-nights",
      adr: (c) => `ADR (${c})`,
      adrShort: "ADR",
      withBasis: (w, b) => `${w} (${b})`,
      nothingPeriod: "Nothing in this period.",
      noRevenuePeriod: "No revenue in this period.",
      nothingOnBooks: "Nothing on the books yet.",
      nothingCommitted: "Nothing committed in this window yet.",
    },
  },
  bg: {
    title: "Анализи",
    subtitle: (sc) => `${sc} · заетост, цена и приходи за периода, който изберете`,
    exportExcel: "Експорт в Excel",
    csv: "CSV",
    tabs: {
      performance: "Резултати", pickup: "Нови резервации и темп", source: "Източници и канали", products: "Типове стаи и ценови планове",
      cancellation: "Анулации", otb: "Потвърдени напред", availability: "Наличност",
    },
    stayDate: "Дата на престой",
    bookDate: "Дата на резервация",
    lensHint: { book: "продажби — кога е резервирано", stay: "заетост — кога е престоят" },
    gran: { d: "По дни", w: "По седмици", m: "По месеци" },
    granAdj: { d: "дневни", w: "седмични", m: "месечни" },
    comparedWith: "Сравнено с",
    lastYear: "Миналата година",
    lastWeek: "Миналата седмица",
    portfolio: (n) => `Общо за ${n} обекта.`,
    portfolioTail: " Заетостта, ADR и RevPAR се изчисляват от сумите на нощувките и приходите — никога като средно.",
    portfolioAvailability: (p) => ` Календарът на наличността показва само ${p} (типовете стаи са различни за всеки обект).`,
    week: (m) => `седм. ${m}`,
    revenueDisplay: { gross: "бруто", net: "нето" },
    perf: {
      occupancy: "Заетост", occupancyHint: "Продадени нощувки ÷ налични нощувки за периода. Разликата е в процентни пунктове спрямо базата за сравнение.",
      adr: "ADR", adrHint: "Средна цена на нощувка = приходи от стаи ÷ продадени нощувки. Изчислява се от сумите за периода, не като средно от дневните ADR.",
      revpar: "RevPAR", revparHint: "Приход на налична стая = приходи от стаи ÷ налични нощувки (= ADR × заетост). Най-точният единичен показател за доходност.",
      revenue: (d) => `Приходи (${d})`, revenueHint: (d) => `Приходи от стаи за периода (${d}). Бруто = както е продадено; нето изважда комисионната на каналите — избира се в Настройки.`,
      roomNights: "Нощувки", roomNightsHint: "Общо продадени нощувки за периода — обемът зад ADR и заетостта.",
      prior: (v) => `${v} преди`,
      evolution: (r, g) => `Развитие · ${r} · ${g}`,
      evolutionSub: (c) => `Нощувки (колони) и ADR (линии) — този период спрямо ${c.toLowerCase()}`,
      multiDay: "Изберете период от няколко дни, за да видите тенденцията.",
      byRoomType: "Резултати по тип стая",
      byRoomTypeSub: "Приходи по тип — нощувки и ADR на всяка колона",
      noSold: "Няма продадени нощувки в този период.",
      nightsAdr: (n, a) => `${s(n, "нощувка", "нощувки")} · ADR ${a}`,
      detailed: (g) => `Подробни ${g} данни — числата зад графиките`,
      cols: { date: "Дата", week: "Седмица", month: "Месец", available: "Налични", sold: "Продадени", occupancy: "Заетост", revenue: "Приходи", adr: "ADR", revpar: "RevPAR" },
    },
    production: {
      title: (r, b, n, rev, c) => `Продажби · ${r} · ${s(b, "резервация", "резервации")} · ${s(n, "нощувка", "нощувки")} · ${rev} резервирани (${c} анулирани след това)`,
      cols: { bookedOn: "Резервирано на", bookings: "Резервации", nights: "Нощувки", revenue: "Резервирани приходи", cancelled: "Анулирани след това" },
      empty: "В този период няма направени резервации.",
    },
    products: {
      byRoom: (r) => `По тип стая · ${r}`,
      byPlan: (r) => `По ценови план · ${r}`,
      basisBook: "резервирани в периода",
      basisStay: "престои в периода",
    },
    otb: {
      next: (n) => `Следващите ${n} дни — потвърдени`,
      occupancy: "потвърдена заетост",
      revenue: "потвърдени приходи",
      nights: "потвърдени нощувки",
      arrivals: "пристигания / напускания",
      title: "Потвърдено търсене · следващите 30 дни",
      allInWeek: "Всички потвърдени нощувки са в следващите 7 дни — затова двете карти по-долу съвпадат",
      perArrival: (d) => `Вече продадени нощувки по дата на пристигане · ${s(d, "ден", "дни")} с резервации`,
      unit: "Потвърдени нощувки",
      disclaimer: "Очаквани стойности от потвърдени резервации — не е модел за прогнозиране. Новите резервации ги увеличават, анулациите ги намаляват.",
    },
    pickup: {
      title: "Нови резервации и темп · следващите 30 дни",
      against: (d, g, l) => `Спрямо снимката от ${d} · ${s(g, "дата", "дати")} с ръст, ${l} със спад`,
      first: "Първата снимка е направена днес — темпът се появява с натрупването на история",
      footnote: "Оцветената ивица показва новите резервации след снимката. Данните по дни са в CSV експорта.",
      soldNow: "Продадени сега",
      atSnapshot: "При снимката",
      pickup: "Ръст",
      needsTwo: "Темпът има нужда от поне два дни и една по-ранна снимка за сравнение.",
    },
    source: {
      costTitle: (r) => `Цена на дистрибуцията · ${r}`,
      paid: "Платена комисионна",
      noOta: "няма приходи от OTA в този период",
      rateNotSet: (a) => `${a} приходи от OTA · комисионната не е зададена`,
      ofOta: (p, a) => `${p} от ${a} приходи от OTA`,
      direct: "Директни резервации",
      directOf: (a, b) => `${a} от ${b} · без комисионна`,
      avoided: "Спестена комисионна",
      estimate: " · оценка",
      ifDirect: (p) => `ако директните резервации бяха дошли през каналите Ви при ${p}`,
      setRate: "задайте комисионна на каналите си и това ще може да се изчисли",
      needsOta: "трябват приходи от OTA в периода, за да има с какъв процент да се сравни",
      paidIsActual: "Платената комисионна е реална",
      paidIsActualTail: " — собствените проценти на каналите, приложени към приходите, които са донесли. ",
      avoidedIsEstimate: "Спестената комисионна е оценка",
      avoidedTail: ": приема, че тези директни гости иначе биха резервирали през OTA, което за някои е вярно, а за други не. ",
      keptHidden: (a) => `Задържаните приходи не се показват: за ${a} от приходите от OTA няма зададена комисионна, така че реалната цена е неизвестна.`,
      kept: "Задържани приходи след реалната комисионна: ",
      mixTitle: (r) => `Източници · ${r}`,
      mixSub: "Откъде идва бизнесът и колко реално остава от всеки канал",
      totalRevenue: "общо приходи",
      noCommission: "без комисионна",
      rateMissing: "не е зададена",
      commission: (p) => `${p}% комисионна`,
      whatYouKeep: "Какво Ви остава след комисионната",
      noRevenue: "Няма приходи в този период.",
      realLower: "комисионната не е зададена — реалната сума е по-ниска",
      keepsAll: (n) => `${s(n, "нощувка", "нощувки")} · остават 100%`,
      minus: (n, a) => `${s(n, "нощувка", "нощувки")} · −${a}`,
      byName: (c) => `${c} по източник`,
    },
    cancel: {
      title: (r) => `Анулации · ${r}`,
      counted: (l, b) => `Броени ${l === "book" ? "по дата на резервация" : "по дата на престой"} — ${b}`,
      basis: (l, n) => l === "book"
        ? `от ${s(n, "резервация, направена", "резервации, направени")} в този период`
        : `от ${s(n, "престой", "престоя")} в този период`,
      ofReservations: "от резервациите",
      gaugeAria: (p) => `Процент анулации ${p} от резервациите`,
      ofScale: (a, b) => `${a} от ${b} · скалата стига до 30%`,
      ofRoomNights: "от нощувките",
      nightsOf: (a, b) => `${a} от ${b} нощувки — числото, което има значение за приходите`,
      bySource: "По източник",
      direct: "Директно",
      none: "Няма анулации в този период.",
      listLead: "Кои резервации са анулирани е списък, затова е там, където са списъците — ",
      listLink: "Резервации, филтрирани по анулирани",
      listTail: ". CSV експортът тук съдържа всички подробности.",
    },
    avail: {
      title: (f, t) => `Наличност · ${f} → ${t} · налични по тип стая`,
      sub: "Оцветено според това каква част от всеки тип стая още може да се продаде — не по абсолютен брой",
      roomType: "Тип стая",
      rooms: (n) => s(n, "стая", "стаи"),
      cellTitle: (d, l, o) => `${d} · ${l} от ${o} налични`,
      overbooked: "свръхрезервация",
      under: (p) => `под ${p}% налични`,
      footnote: " — спрямо всеки тип стая, за да не се отбелязва малък тип заради две свободни от три. Подробности по дни има в Календара на наличността.",
    },
    chart: {
      roomNights: "Нощувки",
      adr: (c) => `ADR (${c})`,
      adrShort: "ADR",
      withBasis: (w, b) => `${w} (${b})`,
      nothingPeriod: "Няма данни за този период.",
      noRevenuePeriod: "Няма приходи в този период.",
      nothingOnBooks: "Все още няма потвърдени резервации.",
      nothingCommitted: "Все още нищо не е потвърдено за този период.",
    },
  },
};
