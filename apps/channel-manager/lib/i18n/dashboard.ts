import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Dashboard — distribution health at a glance.
 *
 * Several sentences here are core's (`syncRecencyHealth`, `failureVerdict`, `pendingSubtitle`,
 * `describeAge`, `reviolinkSetup`), worded again by their code so they can be Bulgarian; the drift
 * test holds the English to core's, word for word.
 */
export interface CmDashboardStrings {
  title: string;
  subtitle: (property: string) => string;
  syncingLive: string;
  someNotConnected: string;
  noneConnected: string;
  setupPromise: string;
  setupSteps: Record<string, { title: string; body: string; cta: string }>;
  cards: {
    connected: string; connectedNone: string; connectedAll: string; connectedMissing: (n: number) => string;
    active: string; activeSub: string; activeNone: string;
    unmapped: string; unmappedSub: string; unmappedClear: string; unmappedNothing: string;
    pending: string;
    failed: string; failedSub: string;
    lastSync: string; lastSyncSub: string;
  };
  pills: {
    none: string; healthy: string; partial: string; sellable: string; action: string; clear: string;
    stuck: string; queued: string;
  };
  /** core `syncRecencyHealth` / `failureVerdict`, by health. */
  /** `detail` is "" where core has none (null) — a translation cannot tell null from missing. */
  recency: Record<"idle" | "healthy" | "stale" | "dead", { label: string; detail: string }>;
  failure: {
    unknown: { label: string; detail: string };
    dead: { label: string; detail: (failures: number, attempts: number) => string };
    healthy: { label: string; detail: (attempts: number) => string };
  };
  /** core `pendingSubtitle` + `describeAge`. */
  pendingSub: {
    empty: string;
    waiting: (n: number) => string;
    waitingOldest: (n: number, age: string) => string;
  };
  age: { justNow: string; min: (n: number) => string; hours: (n: number) => string; oneDay: string; days: (n: number) => string };
  channelStatus: string;
  viewAll: string;
  cols: { channel: string; status: string; lastSync: string; pending: string; errors: string };
  noChannelsLead: string;
  noChannelsLink: string;
  noChannelsTail: string;
  connected: string;
  paused: string;
  never: string;
  quickActions: string;
  actions: { calendar: string; bulk: string; connect: string; fixMapping: string; retry: string };
  recentActivity: string;
  syncCenter: string;
  noActivity: string;
  summary: { title: string; today: string; yesterday: string; newRes: string; cancelled: string; madeOn: (day: string) => string; cancelledOn: (day: string) => string };
  latest: string;
  all: string;
  noBookings: string;
  stopSold: string;
  stopSoldSub: string;
  currency: string;
  currencySub: string;
  needsAttention: string;
  errorCenter: string;
  severity: Record<string, string>;
}

export const dashboard: Translations<CmDashboardStrings> = {
  en: {
    title: "Dashboard",
    subtitle: (p) => `${p} · distribution health`,
    syncingLive: "Syncing live",
    someNotConnected: "Some channels are not connected",
    noneConnected: "No channels connected",
    setupPromise: "Four steps and your rooms are on sale across every channel you connect.",
    setupSteps: {
      property: { title: "Your property is set up", body: "Created with your account, along with a starting rate plan.", cta: "Review" },
      "room-types": { title: "Add your room types", body: "The rooms you sell — Double, Suite, and how many of each you have.", cta: "Add room types" },
      rates: { title: "Set your rates", body: "Price the dates you want to sell. Bulk Rates fills a whole season in one go.", cta: "Set rates" },
      channels: { title: "Connect a channel", body: "Booking.com, Expedia and the rest — this is what puts your rooms on sale.", cta: "Connect a channel" },
      mapping: { title: "Map your products", body: "Match each room type and rate plan to the channel's own listing so updates land correctly.", cta: "Open mapping" },
    },
    cards: {
      connected: "Connected Channels", connectedNone: "No channels connected yet", connectedAll: "All channels connected",
      connectedMissing: (n) => `${n} not connected`,
      active: "Active Products", activeSub: "Room types × rate plans", activeNone: "Add a room type to start",
      unmapped: "Unmapped Products", unmappedSub: "Require mapping", unmappedClear: "Everything is mapped", unmappedNothing: "Nothing to map yet",
      pending: "Pending Updates",
      failed: "Failed Syncs", failedSub: "Real failures · 24h (limitations excluded)",
      lastSync: "Last Successful Sync", lastSyncSub: "Across all channels",
    },
    pills: { none: "None", healthy: "Healthy", partial: "Partial", sellable: "Sellable", action: "Action", clear: "Clear", stuck: "Stuck?", queued: "Queued" },
    recency: {
      idle: { label: "Never synced", detail: "No sync has run yet." },
      healthy: { label: "Live", detail: "" },
      stale: { label: "Stale", detail: "Hasn't synced in over a day." },
      dead: { label: "Not syncing", detail: "Nothing has synced in over a week." },
    },
    failure: {
      unknown: { label: "Nothing attempted", detail: "No syncs were attempted in the last 24 hours." },
      dead: { label: "Review", detail: (f, a) => `${f} of ${a} failed in the last 24 hours.` },
      healthy: { label: "Clear", detail: (a) => `${a} succeeded in the last 24 hours.` },
    },
    pendingSub: {
      empty: "Queue empty — all delivered.",
      waiting: (n) => `${n} ${n === 1 ? "update" : "updates"} waiting to be delivered.`,
      waitingOldest: (n, age) => `${n} ${n === 1 ? "update" : "updates"} waiting — oldest ${age}.`,
    },
    age: { justNow: "just now", min: (n) => `${n} min ago`, hours: (n) => `${n}h ago`, oneDay: "1 day ago", days: (n) => `${n} days ago` },
    channelStatus: "Channel Status",
    viewAll: "View all",
    cols: { channel: "Channel", status: "Status", lastSync: "Last Successful Sync", pending: "Pending", errors: "Errors" },
    noChannelsLead: "No channels yet. ",
    noChannelsLink: "Connect your first channel",
    noChannelsTail: " to put your rooms on sale.",
    connected: "Connected",
    paused: "Paused",
    never: "Never",
    quickActions: "Quick Actions",
    actions: { calendar: "Open Calendar", bulk: "Bulk Rates", connect: "Connect Channel", fixMapping: "Fix Mapping", retry: "Retry Failed Syncs" },
    recentActivity: "Recent Activity",
    syncCenter: "Sync Center",
    noActivity: "Nothing has been pushed or pulled yet. Activity appears here the moment a channel is connected.",
    summary: {
      title: "Reservation Summary", today: "today", yesterday: "yesterday", newRes: "New reservations", cancelled: "Cancelled",
      madeOn: (d) => `Made ${d}`, cancelledOn: (d) => `Cancelled ${d}`,
    },
    latest: "Latest Reservations",
    all: "All",
    noBookings: "No bookings imported yet.",
    stopSold: "Stop-Sold",
    stopSoldSub: "Products held back",
    currency: "Currency",
    currencySub: "Channels in FX",
    needsAttention: "Needs Attention",
    errorCenter: "Error Center",
    severity: { critical: "critical", warning: "warning", info: "info" },
  },
  bg: {
    title: "Табло",
    subtitle: (p) => `${p} · състояние на дистрибуцията`,
    syncingLive: "Синхронизира се",
    someNotConnected: "Някои канали не са свързани",
    noneConnected: "Няма свързани канали",
    setupPromise: "Четири стъпки и стаите Ви се продават във всеки канал, който свържете.",
    setupSteps: {
      property: { title: "Обектът Ви е настроен", body: "Създаден е заедно с акаунта, с начален ценови план.", cta: "Преглед" },
      "room-types": { title: "Добавете типовете стаи", body: "Стаите, които продавате — двойна, апартамент — и колко имате от всяка.", cta: "Добави типове стаи" },
      rates: { title: "Задайте цените", body: "Задайте цени за датите, които искате да продавате. Масовите промени попълват цял сезон наведнъж.", cta: "Задай цени" },
      channels: { title: "Свържете канал", body: "Booking.com, Expedia и останалите — това пуска стаите Ви в продажба.", cta: "Свържи канал" },
      mapping: { title: "Свържете продуктите", body: "Свържете всеки тип стая и ценови план с обявата на канала, за да стигат промените на правилното място.", cta: "Отвори съответствията" },
    },
    cards: {
      connected: "Свързани канали", connectedNone: "Все още няма свързани канали", connectedAll: "Всички канали са свързани",
      connectedMissing: (n) => `${n} ${n === 1 ? "не е свързан" : "не са свързани"}`,
      active: "Активни продукти", activeSub: "Типове стаи × ценови планове", activeNone: "Добавете тип стая, за да започнете",
      unmapped: "Несвързани продукти", unmappedSub: "Трябва да се свържат", unmappedClear: "Всичко е свързано", unmappedNothing: "Още няма нищо за свързване",
      pending: "Чакащи промени",
      failed: "Неуспешни синхронизации", failedSub: "Реални грешки · 24 ч (без ограниченията на каналите)",
      lastSync: "Последна успешна синхронизация", lastSyncSub: "За всички канали",
    },
    pills: { none: "Няма", healthy: "Наред", partial: "Частично", sellable: "Продават се", action: "Действие", clear: "Чисто", stuck: "Заседнали?", queued: "На опашка" },
    recency: {
      idle: { label: "Никога не е синхронизирано", detail: "Все още не е имало синхронизация." },
      healthy: { label: "На живо", detail: "" },
      stale: { label: "Остаряло", detail: "Не е синхронизирано повече от ден." },
      dead: { label: "Не се синхронизира", detail: "Нищо не е синхронизирано повече от седмица." },
    },
    failure: {
      unknown: { label: "Нищо не е опитвано", detail: "През последните 24 часа не е опитвана синхронизация." },
      dead: { label: "Проверете", detail: (f, a) => `${f} от ${a} са неуспешни през последните 24 часа.` },
      healthy: { label: "Чисто", detail: (a) => `${a} успешни през последните 24 часа.` },
    },
    pendingSub: {
      empty: "Опашката е празна — всичко е доставено.",
      waiting: (n) => `${n} ${n === 1 ? "промяна чака" : "промени чакат"} да бъдат доставени.`,
      waitingOldest: (n, age) => `${n} ${n === 1 ? "промяна чака" : "промени чакат"} — най-старата ${age}.`,
    },
    age: { justNow: "току-що", min: (n) => `преди ${n} мин`, hours: (n) => `преди ${n} ч`, oneDay: "преди 1 ден", days: (n) => `преди ${n} дни` },
    channelStatus: "Състояние на каналите",
    viewAll: "Виж всички",
    cols: { channel: "Канал", status: "Статус", lastSync: "Последна успешна синхронизация", pending: "Чакащи", errors: "Грешки" },
    noChannelsLead: "Все още няма канали. ",
    noChannelsLink: "Свържете първия си канал",
    noChannelsTail: ", за да пуснете стаите в продажба.",
    connected: "Свързан",
    paused: "На пауза",
    never: "Никога",
    quickActions: "Бързи действия",
    actions: { calendar: "Отвори календара", bulk: "Масови цени", connect: "Свържи канал", fixMapping: "Оправи съответствията", retry: "Повтори неуспешните" },
    recentActivity: "Последна активност",
    syncCenter: "Синхронизация",
    noActivity: "Все още нищо не е изпращано или изтегляно. Активността се появява тук, щом свържете канал.",
    summary: {
      title: "Резервации накратко", today: "днес", yesterday: "вчера", newRes: "Нови резервации", cancelled: "Анулирани",
      madeOn: (d) => `Направени ${d}`, cancelledOn: (d) => `Анулирани ${d}`,
    },
    latest: "Последни резервации",
    all: "Всички",
    noBookings: "Все още няма внесени резервации.",
    stopSold: "Спрени от продажба",
    stopSoldSub: "Задържани продукти",
    currency: "Валута",
    currencySub: "Канали с друга валута",
    needsAttention: "Изисква внимание",
    errorCenter: "Грешки",
    severity: { critical: "критично", warning: "предупреждение", info: "информация" },
  },
};
