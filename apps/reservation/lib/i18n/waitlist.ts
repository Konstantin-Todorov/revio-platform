import type { Translations } from "@revio/ui/i18n";

/** The Waitlist — demand on dates the hotel could not sell, and what it turned into. */
export interface WaitlistStrings {
  title: string;
  subtitle: string;
  check: string;
  tabs: Record<"waiting" | "offered" | "converted" | "expired" | "all", string>;
  statuses: Record<string, string>;
  recovered: string;
  recoveredSub: (n: number) => string;
  waitingSub: string;
  offeredSub: string;
  noOffers: string;
  offersTaken: (pct: string) => string;
  summary: (offers: number, offered: number, entries: number) => string;
  recoveryRate: (pct: string) => string;
  typically: (wait: string) => string;
  withoutValue: (n: number) => string;
  duration: { min: (n: number) => string; hours: (n: number) => string; days: (n: number) => string };
  since: { justNow: string; hours: (n: number) => string; days: (n: number) => string };
  listSubtitle: string;
  emptyTitle: string;
  emptyBody: string;
  cols: { guest: string; dates: string; room: string; waiting: string; status: string; offers: string };
  stay: (nights: number, guests: number) => string;
  any: string;
  heldUntil: (time: string) => string;
  exhausted: string;
  booking: string;
  remove: string;
  sweep: {
    running: string;
    nothing: string;
    offered: (n: number) => string;
    lapsed: (n: number) => string;
    staled: (n: number) => string;
  };
  nothingSelected: string;
}

export const waitlist: Translations<WaitlistStrings> = {
  en: {
    title: "Waitlist",
    subtitle: "Demand on dates you could not sell — and what it turned into",
    check: "Check for openings",
    tabs: { waiting: "Waiting", offered: "Offered", converted: "Converted", expired: "Expired", all: "All" },
    statuses: { waiting: "waiting", offered: "offered", converted: "converted", expired: "expired", cancelled: "cancelled" },
    recovered: "Recovered this month",
    recoveredSub: (n) => `${n} ${n === 1 ? "stay" : "stays"} that would have been lost`,
    waitingSub: "on the list now",
    offeredSub: "room held, waiting on the guest",
    noOffers: "no offers made yet",
    offersTaken: (p) => `${p} of offers taken`,
    summary: (o, d, e) => `${o} offer${o === 1 ? "" : "s"} made to ${d} of ${e} ${e === 1 ? "entry" : "entries"}`,
    recoveryRate: (p) => ` · ${p} of everyone who joined ended up with a room`,
    typically: (w) => ` · typically ${w} from joining to an offer`,
    withoutValue: (n) => ` · ${n} converted ${n === 1 ? "stay is" : "stays are"} no longer on file, so recovered revenue excludes ${n === 1 ? "it" : "them"}`,
    duration: { min: (n) => `${n} min`, hours: (n) => `${n} hour${n === 1 ? "" : "s"}`, days: (n) => `${n} days` },
    since: { justNow: "just now", hours: (n) => `${n}h`, days: (n) => `${n}d` },
    listSubtitle: "Oldest first — position in the queue is the order they joined, never a stored number",
    emptyTitle: "Nobody on the list",
    emptyBody: "When a guest searches dates you cannot sell, your booking page offers to tell them if a room opens. Anyone who takes that up appears here.",
    cols: { guest: "Guest", dates: "Dates", room: "Room", waiting: "Waiting", status: "Status", offers: "Offers" },
    stay: (n, g) => `${n} ${n === 1 ? "night" : "nights"} · ${g} ${g === 1 ? "guest" : "guests"}`,
    any: "Any",
    heldUntil: (t) => `held until ${t}`,
    exhausted: "no more — 3 lapsed",
    booking: "Booking",
    remove: "Remove",
    sweep: {
      running: "A check is already running. This list will update in a moment.",
      nothing: "Checked — nothing has opened up for anyone waiting.",
      offered: (n) => `${n} offer${n === 1 ? "" : "s"} sent`,
      lapsed: (n) => `${n} expired offer${n === 1 ? "" : "s"} back on the list`,
      staled: (n) => `${n} past their arrival date, closed`,
    },
    nothingSelected: "Nothing was selected to remove. Reload the page and try again.",
  },
  bg: {
    title: "Списък на чакащите",
    subtitle: "Търсене за дати, които не можахте да продадете — и какво стана от него",
    check: "Провери за освободени стаи",
    tabs: { waiting: "Чакат", offered: "С оферта", converted: "Резервирали", expired: "Изтекли", all: "Всички" },
    statuses: { waiting: "чака", offered: "с оферта", converted: "резервирал", expired: "изтекъл", cancelled: "анулиран" },
    recovered: "Спасени този месец",
    recoveredSub: (n) => `${n} ${n === 1 ? "престой, който щеше" : "престоя, които щяха"} да бъдат загубени`,
    waitingSub: "в списъка сега",
    offeredSub: "стаята е задържана, чака се гостът",
    noOffers: "все още няма направени оферти",
    offersTaken: (p) => `${p} от офертите са приети`,
    summary: (o, d, e) => `${o} ${o === 1 ? "оферта" : "оферти"} до ${d} от ${e} ${e === 1 ? "записан" : "записани"}`,
    recoveryRate: (p) => ` · ${p} от всички записани са получили стая`,
    typically: (w) => ` · обикновено ${w} от записването до оферта`,
    withoutValue: (n) => ` · ${n} ${n === 1 ? "резервиран престой вече не е" : "резервирани престоя вече не са"} в системата, затова спасените приходи ${n === 1 ? "не го включват" : "не ги включват"}`,
    duration: { min: (n) => `${n} мин`, hours: (n) => `${n} ${n === 1 ? "час" : "часа"}`, days: (n) => `${n} дни` },
    since: { justNow: "току-що", hours: (n) => `${n} ч`, days: (n) => `${n} д` },
    listSubtitle: "Най-старите първо — редът в опашката е редът на записване, никога запазено число",
    emptyTitle: "Никой не чака",
    emptyBody: "Когато гост търси дати, които не можете да продадете, страницата Ви за резервации предлага да го уведоми при освободена стая. Всеки, който приеме, се появява тук.",
    cols: { guest: "Гост", dates: "Дати", room: "Стая", waiting: "Чака от", status: "Статус", offers: "Оферти" },
    stay: (n, g) => `${n} ${n === 1 ? "нощувка" : "нощувки"} · ${g} ${g === 1 ? "гост" : "гости"}`,
    any: "Всяка",
    heldUntil: (t) => `задържана до ${t}`,
    exhausted: "край — 3 изтекли",
    booking: "Резервация",
    remove: "Премахни",
    sweep: {
      running: "Вече тече проверка. Списъкът ще се обнови след малко.",
      nothing: "Проверено — не се е освободило нищо за чакащите.",
      offered: (n) => `${n} ${n === 1 ? "изпратена оферта" : "изпратени оферти"}`,
      lapsed: (n) => `${n} ${n === 1 ? "изтекла оферта е" : "изтекли оферти са"} отново в списъка`,
      staled: (n) => `${n} с минала дата на пристигане — затворени`,
    },
    nothingSelected: "Нищо не е избрано за премахване. Презаредете страницата и опитайте отново.",
  },
};
