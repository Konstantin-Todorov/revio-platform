import type { Translations } from "@revio/ui/i18n";

/** The folio list — open bills, receivables, the settled archive. Accounting words as in `folio.ts`. */
export interface FoliosStrings {
  title: string;
  subtitle: string;
  tabs: { open: string; receivables: string; history: string };
  noOneTitle: string;
  noOneBefore: string;
  frontDesk: string;
  nothingOutstanding: string;
  nothingOutstandingBody: string;
  unpaid: (n: number) => string;
  left: (date: string) => string;
  today: string;
  days: (n: number) => string;
  receivablesNote: string;
  searchHistory: string;
  search: string;
  clear: string;
  noMatch: (q: string) => string;
  noArchive: string;
  cols: { guest: string; stay: string; room: string; invoice: string; balance: string; status: string };
  settled: string;
  balanceDue: string;
  open: string;
  readOnly: string;
  table: { search: string; whoOwes: string; room: (units: string) => string; notOpened: string; settled: string; noMatch: (q: string) => string };
  outcomes: {
    title: string;
    subtitle: (days: number) => string;
    none: string;
    collected: string;
    owed: string;
    lost: string;
    folios: (n: number) => string;
    labels: Record<"settled" | "paid_offsystem" | "outstanding" | "written_off", { label: string; meaning: string }>;
  };
}

export const folios: Translations<FoliosStrings> = {
  en: {
    title: "Folios & Billing",
    subtitle: "Open = live bills for in-house guests. Receivables = money owed by guests who have left. History = the settled financial record.",
    tabs: { open: "Open", receivables: "Receivables", history: "History" },
    noOneTitle: "No one in house",
    noOneBefore: "Folios open automatically when a guest checks in. Check someone in from the",
    frontDesk: "Front Desk",
    nothingOutstanding: "Nothing outstanding",
    nothingOutstandingBody: "Every departed guest has settled. A stay checked out with an unpaid balance lands here until a manager resolves it.",
    unpaid: (n) => `${n} unpaid folio${n === 1 ? "" : "s"} · oldest first`,
    left: (d) => ` · left ${d}`,
    today: "today",
    days: (n) => `${n}d`,
    receivablesNote: "Open a folio to resolve it — reopen and take payment, mark it paid off-system, keep chasing it, or write it off.",
    searchHistory: "Search guest, reservation # or invoice #…",
    search: "Search",
    clear: "Clear",
    noMatch: (q) => `No settled folios match “${q}”.`,
    noArchive: "No departed stays yet — the archive fills as guests check out.",
    cols: { guest: "Guest", stay: "Stay", room: "Room", invoice: "Invoice", balance: "Balance", status: "Status" },
    settled: "Settled",
    balanceDue: "Balance due",
    open: "Open",
    readOnly: "History is read-only — a closed folio is corrected with a credit note, never edited.",
    table: {
      search: "Search guest or room…",
      whoOwes: "Who owes",
      room: (u) => `Room ${u}`,
      notOpened: "Not opened",
      settled: "Settled",
      noMatch: (q) => `No open folios match “${q}”.`,
    },
    outcomes: {
      title: "How closed folios ended",
      subtitle: (d) => `Last ${d} days · collected, owed and lost are three separate numbers`,
      none: "No folios have been closed in this period.",
      collected: "Collected",
      owed: "Still owed",
      lost: "Written off",
      folios: (n) => `${n} folio${n === 1 ? "" : "s"}`,
      labels: {
        settled: { label: "Settled", meaning: "Paid in full through the folio." },
        paid_offsystem: { label: "Paid off-system", meaning: "The money arrived by bank transfer, cash or an external terminal. Collected, just not through us." },
        outstanding: { label: "Still owed", meaning: "Closed carrying a balance. A tracked receivable, not a loss — yet." },
        written_off: { label: "Written off", meaning: "Forgiven. This is a loss, and it is never a payment." },
      },
    },
  },
  bg: {
    title: "Сметки и плащания",
    subtitle: "Отворени — текущите сметки на гостите в хотела. Вземания — пари, дължими от вече напуснали гости. История — уредените сметки.",
    tabs: { open: "Отворени", receivables: "Вземания", history: "История" },
    noOneTitle: "Няма гости в хотела",
    noOneBefore: "Сметките се отварят автоматично при настаняване. Настанете гост от",
    frontDesk: "Рецепцията",
    nothingOutstanding: "Няма неплатени сметки",
    nothingOutstandingBody: "Всички напуснали гости са платили. Престой, приключил с неплатено салдо, се появява тук, докато управител не го уреди.",
    unpaid: (n) => `${n} ${n === 1 ? "неплатена сметка" : "неплатени сметки"} · най-старите първо`,
    left: (d) => ` · напуснал на ${d}`,
    today: "днес",
    days: (n) => `${n} дни`,
    receivablesNote: "Отворете сметката, за да я уредите — отворете я отново и приемете плащане, отбележете като платена извън системата, оставете като вземане или я отпишете.",
    searchHistory: "Търсене по гост, № на резервация или № на фактура…",
    search: "Търси",
    clear: "Изчисти",
    noMatch: (q) => `Няма уредени сметки за „${q}“.`,
    noArchive: "Все още няма приключили престои — историята се попълва с напусканията.",
    cols: { guest: "Гост", stay: "Престой", room: "Стая", invoice: "Фактура", balance: "Салдо", status: "Статус" },
    settled: "Уредена",
    balanceDue: "Дължи",
    open: "Отворена",
    readOnly: "Историята е само за преглед — затворена сметка се коригира с кредитно известие, никога с редакция.",
    table: {
      search: "Търсене по гост или стая…",
      whoOwes: "Кой дължи",
      room: (u) => `Стая ${u}`,
      notOpened: "Не е отворена",
      settled: "Уредена",
      noMatch: (q) => `Няма отворени сметки за „${q}“.`,
    },
    outcomes: {
      title: "Как са приключили затворените сметки",
      subtitle: (d) => `Последните ${d} дни · събрано, дължимо и загубено са три отделни числа`,
      none: "През този период няма затворени сметки.",
      collected: "Събрано",
      owed: "Още се дължи",
      lost: "Отписано",
      folios: (n) => `${n} ${n === 1 ? "сметка" : "сметки"}`,
      labels: {
        settled: { label: "Уредена", meaning: "Платена изцяло чрез сметката." },
        paid_offsystem: { label: "Платена извън системата", meaning: "Парите са дошли по банков път, в брой или през външен терминал. Събрани са, само не чрез нас." },
        outstanding: { label: "Още се дължи", meaning: "Затворена с неплатено салдо. Вземане, което се следи — все още не е загуба." },
        written_off: { label: "Отписана", meaning: "Опростена. Това е загуба и никога не е плащане." },
      },
    },
  },
};
