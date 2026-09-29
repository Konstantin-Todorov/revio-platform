import type { Translations } from "@revio/ui/i18n";

/**
 * RevioLink's Mapping screen — linking our room types and rate plans to each channel's own ids,
 * the warnings above the tables, Verify, and "send it now" for a product set up too late.
 *
 * `crossWire` is core's `describeCrossWire`, worded by reason; the drift test holds the English to
 * core's. Channel product names and ids are the channel's and are never translated.
 */
export interface CmMappingStrings {
  title: string;
  subtitle: string;
  empty: { subtitle: string; title: string; body: string; action: string };
  pulled: (n: number, channel: string) => string;
  status: Record<"complete" | "incomplete" | "never_sent", string>;
  crossWireTitle: (n: number, channel: string) => string;
  crossWire: {
    wrongRoom: (room: string, plan: string, belongsTo: string | null) => string;
    gone: (room: string, plan: string, externalId: string) => string;
  };
  fixRow: string;
  derivedTitle: (n: number, channel: string) => string;
  derivedBody: (channel: string) => string;
  derivesFrom: (channel: string, parent: string) => string;
  seeRow: string;
  collisionTitle: (n: number) => string;
  usedBy: string;
  collisionTail: string;
  and: string;
  alertsTitle: (n: number) => string;
  jumpToRow: string;
  autofix: (n: number) => string;
  neverSent: (n: number) => string;
  allMapped: string;
  roomsTitle: (channel: string) => string;
  roomsNote: string;
  ratesTitle: (channel: string) => string;
  ratesNote: string;
  cols: { room: string; externalRoom: string; plan: string; externalRate: string; status: string };
  toConfirm: (n: number) => string;
  currentlyPublishing: (id: string) => string;
  derivedOption: (name: string) => string;
  notes: {
    roomFirst: (room: string, channel: string) => string;
    noPlans: (channel: string, room: string) => string;
    excluded: (channel: string, room: string, n: number) => string;
  };
  dialog: {
    edit: string;
    title: Record<"room" | "rate", string>;
    lead: [string, string, string];
    fromChannel: (channel: string, kind: "room" | "rate") => string;
    fromChannelHint: string;
    notMapped: string;
    current: (id: string) => string;
    manual: string;
    manualHint: string;
    idLabel: Record<"room" | "rate", string>;
    idHint: Record<"room" | "rate", string>;
    placeholder: string;
    cancel: string;
    saving: string;
    save: string;
  };
  send: {
    title: (n: number) => string;
    why: string;
    button: (name: string) => string;
    kind: Record<"roomType" | "ratePlan", string>;
    sending: string;
  };
  verify: {
    lead: [string, string];
    reading: string;
    button: string;
    plan: (channel: string, name: string) => string;
    anonymous: (id: string) => string;
    missing: (ours: string) => string;
    unexpected: (theirs: string) => string;
    mismatch: (ours: string, theirs: string) => string;
    derived: (channel: string, parent: string) => string;
    unmanaged: (channel: string) => string;
    rooms: (headline: string) => string;
    roomLine: (ours: number, stopSell: boolean, theirs: number | null) => string;
    restrictions: (headline: string) => string;
    restrictionLine: (field: "minStay" | "maxStay" | "cta" | "ctd" | "stopSell", ours: number | boolean, theirs: number | boolean | null) => string;
  };
}

export const mapping: Translations<CmMappingStrings> = {
  en: {
    title: "Mapping",
    subtitle: "Room types carry how many rooms are free. Rate plans carry prices and restrictions. Both need linking.",
    empty: {
      subtitle: "Link your room types and rate plans to each channel's own listings",
      title: "No channels connected yet",
      body: "Mapping links your room types and rate plans to each channel's own IDs. Connect a channel first, then map them here.",
      action: "Connect a channel",
    },
    pulled: (n, c) => `${n} products pulled from ${c} — pick them from the dropdown when mapping.`,
    status: { complete: "mapped", incomplete: "needs an id", never_sent: "not sent yet" },
    crossWireTitle: (n, c) => `${n === 1 ? "One rate plan is" : `${n} rate plans are`} mapped to the wrong room in ${c}`,
    crossWire: {
      wrongRoom: (r, p, b) => `${r} · ${p} is publishing to a rate plan the channel says belongs to ${b ?? "another room"}. Those prices and that availability are going onto the wrong room.`,
      gone: (r, p, id) => `${r} · ${p} points at rate plan ${id}, which the channel no longer has. Nothing sent for it is arriving.`,
    },
    fixRow: "fix the row",
    derivedTitle: (n, c) => `${n === 1 ? "One price you set is" : `${n} prices you set are`} ignored by ${c}`,
    derivedBody: (c) => `${c} calculates these plans itself from another plan, so guests on the OTAs pay its number, not the one in your calendar — and your own booking page still quotes yours. Either make the plan derived in Rooms & Rates with the same discount, so both sides agree, or switch derivation off for it in ${c}.`,
    derivesFrom: (c, p) => `, which ${c} derives from ${p}`,
    seeRow: "see the row",
    collisionTitle: (n) => `${n === 1 ? "One channel rate plan is" : `${n} channel rate plans are`} mapped to more than one room`,
    usedBy: "is used by",
    collisionTail: "— whichever pushes last overwrites the other. Give each room its own rate plan.",
    and: " and ",
    alertsTitle: (n) => `${n} booking${n > 1 ? "s" : ""} arrived for an unmapped product`,
    jumpToRow: "jump to the row",
    autofix: (n) => `Auto-fix ${n} unmapped`,
    neverSent: (n) => `${n} never sent`,
    allMapped: "All mapped",
    roomsTitle: (c) => `Room Types · ${c}`,
    roomsNote: "inventory & open/close",
    ratesTitle: (c) => `Rate Plans · ${c}`,
    ratesNote: "rates & restrictions",
    cols: { room: "Room Type", externalRoom: "External Room ID", plan: "Rate Plan", externalRate: "External Rate ID", status: "Status" },
    toConfirm: (n) => `${n} to confirm`,
    currentlyPublishing: (id) => `currently publishing to ${id}… — set for this room`,
    derivedOption: (n) => `${n} · derived — the channel computes its rate`,
    notes: {
      roomFirst: (r, c) => `Map the room type "${r}" first — until it has an id in ${c} we cannot tell which of its rate plans belong to this room, and offering all of them is how one room's prices end up on another.`,
      noPlans: (c, r) => `${c} lists no rate plan under ${r}. Create one there, or enter its id below if you know it.`,
      excluded: (c, r, n) => `Showing ${c}'s plans for ${r} only. ${n} plan${n > 1 ? "s are" : " is"} left out because ${n > 1 ? "they belong" : "it belongs"} to one OTA rather than to ${c} — we push to ${c}, and it pushes on.`,
    },
    dialog: {
      edit: "Edit mapping",
      title: { room: "Map room type", rate: "Map rate plan" },
      lead: ["Link ", " to its id in ", ". A filled id ⇒ status becomes complete."],
      fromChannel: (c, k) => `${c}'s ${k === "room" ? "room type" : "rate plan"}s`,
      fromChannelHint: "Pulled from the channel — pick the matching product",
      notMapped: "— not mapped —",
      current: (id) => `current: ${id}`,
      manual: "Or enter an id manually",
      manualHint: "Overrides the dropdown when filled",
      idLabel: { room: "External Room ID", rate: "External Rate ID" },
      idHint: { room: "The channel's own id for this room type", rate: "The channel's own id for this rate plan" },
      placeholder: "e.g. 88291",
      cancel: "Cancel",
      saving: "Saving…",
      save: "Save mapping",
    },
    send: {
      title: (n) => `${n === 1 ? "One product has" : `${n} products have`} never reached your channel manager`,
      why: "They were added after this channel was connected, and setup only sends what exists at the time. No OTA can see them until they are sent.",
      button: (n) => `Send ${n}`,
      kind: { roomType: "room", ratePlan: "rate" },
      sending: "Sending…",
    },
    verify: {
      lead: ["Read back what ", " is publishing right now, and compare it with what we hold."],
      reading: "Reading…",
      button: "Verify",
      plan: (c, n) => `${c} plan “${n}”`,
      anonymous: (id) => `Channel rate plan ${id}…`,
      missing: (o) => `we have ${o}, they have nothing`,
      unexpected: (t) => `they publish ${t}, and Revio does not manage this plan`,
      mismatch: (o, t) => `we have ${o}, they publish ${t}`,
      derived: (c, p) => `${c} calculates this plan from ${p} and ignores the price we send. Make it derived in Rooms & Rates with the same discount, or switch derivation off in ${c}.`,
      unmanaged: (c) => `Plans Revio does not manage keep whatever price was last set in ${c}. If one of them is connected to an OTA, it sells at that price — map it here, or close it in ${c}.`,
      rooms: (h) => `Rooms: ${h}`,
      roomLine: (o, s, t) => `we send ${o}${s ? " (stop-sell on every plan)" : ""}, they offer ${t ?? "nothing"}`,
      restrictions: (h) => `Restrictions: ${h}`,
      restrictionLine: (f, o, t) => {
        const show = (v: number | boolean | null) => v == null ? "nothing" : typeof v === "boolean" ? (v ? "on" : "off") : (f === "maxStay" && v === 0) || (f === "minStay" && v <= 1) ? "none" : `${v} nights`;
        const what = { minStay: "minimum stay", maxStay: "maximum stay", cta: "closed to arrival", ctd: "closed to departure", stopSell: "stop-sell" }[f];
        return `${what} — we send ${show(o)}, they have ${show(t)}`;
      },
    },
  },
  bg: {
    title: "Съответствия",
    subtitle: "Типовете стаи носят колко стаи са свободни. Ценовите планове носят цените и ограниченията. И двете трябва да се свържат.",
    empty: {
      subtitle: "Свържете типовете стаи и ценовите планове с обявите на всеки канал",
      title: "Все още няма свързани канали",
      body: "Съответствията свързват типовете стаи и ценовите Ви планове с ID-тата на всеки канал. Първо свържете канал, после ги свържете тук.",
      action: "Свържи канал",
    },
    pulled: (n, c) => `${n} ${n === 1 ? "продукт е изтеглен" : "продукта са изтеглени"} от ${c} — изберете ги от падащото меню при свързване.`,
    status: { complete: "свързан", incomplete: "липсва ID", never_sent: "още не е изпратен" },
    crossWireTitle: (n, c) => `${n === 1 ? "Един ценови план е свързан" : `${n} ценови плана са свързани`} с грешна стая в ${c}`,
    crossWire: {
      wrongRoom: (r, p, b) => `${r} · ${p} публикува в ценови план, който според канала е на ${b ?? "друга стая"}. Тези цени и наличност отиват на грешната стая.`,
      gone: (r, p, id) => `${r} · ${p} сочи към ценови план ${id}, който каналът вече няма. Нищо изпратено за него не пристига.`,
    },
    fixRow: "поправете реда",
    derivedTitle: (n, c) => `${n === 1 ? "Една цена, която сте задали, се пренебрегва" : `${n} цени, които сте задали, се пренебрегват`} от ${c}`,
    derivedBody: (c) => `${c} сам изчислява тези планове от друг план, така че гостите в OTA плащат неговата цена, а не тази от календара Ви — а собствената Ви страница за резервации продължава да показва Вашата. Или направете плана производен в „Стаи и цени“ със същата отстъпка, за да съвпадат двете страни, или изключете изчисляването за него в ${c}.`,
    derivesFrom: (c, p) => `, който ${c} изчислява от ${p}`,
    seeRow: "вижте реда",
    collisionTitle: (n) => `${n === 1 ? "Един ценови план на канала е свързан" : `${n} ценови плана на канала са свързани`} с повече от една стая`,
    usedBy: "се използва от",
    collisionTail: "— който изпрати последен, презаписва другия. Дайте на всяка стая собствен ценови план.",
    and: " и ",
    alertsTitle: (n) => `${n} ${n === 1 ? "резервация пристигна" : "резервации пристигнаха"} за продукт без съответствие`,
    jumpToRow: "към реда",
    autofix: (n) => `Автоматично свържи ${n}`,
    neverSent: (n) => `${n} никога не са изпратени`,
    allMapped: "Всичко е свързано",
    roomsTitle: (c) => `Типове стаи · ${c}`,
    roomsNote: "наличност и отваряне/затваряне",
    ratesTitle: (c) => `Ценови планове · ${c}`,
    ratesNote: "цени и ограничения",
    cols: { room: "Тип стая", externalRoom: "ID на стаята в канала", plan: "Ценови план", externalRate: "ID на плана в канала", status: "Статус" },
    toConfirm: (n) => `${n} за потвърждение`,
    currentlyPublishing: (id) => `в момента публикува в ${id}… — задайте за тази стая`,
    derivedOption: (n) => `${n} · производен — каналът сам изчислява цената`,
    notes: {
      roomFirst: (r, c) => `Първо свържете типа стая „${r}“ — докато няма ID в ${c}, не можем да кажем кои от ценовите му планове са за тази стая, а да предложим всички е начинът цените на една стая да отидат на друга.`,
      noPlans: (c, r) => `${c} няма ценови план под ${r}. Създайте такъв там или въведете ID-то му по-долу, ако го знаете.`,
      excluded: (c, r, n) => `Показват се само плановете на ${c} за ${r}. ${n === 1 ? "1 план е пропуснат, защото е" : `${n} плана са пропуснати, защото са`} на конкретна OTA, а не на ${c} — ние изпращаме към ${c}, а той ги препраща.`,
    },
    dialog: {
      edit: "Промени съответствието",
      title: { room: "Съответствие на тип стая", rate: "Съответствие на ценови план" },
      lead: ["Свържете ", " с ID-то му в ", ". Попълнено ID ⇒ статусът става „свързан“."],
      fromChannel: (c, k) => `${k === "room" ? "Типове стаи" : "Ценови планове"} в ${c}`,
      fromChannelHint: "Изтеглени от канала — изберете съответния продукт",
      notMapped: "— без съответствие —",
      current: (id) => `текущо: ${id}`,
      manual: "Или въведете ID ръчно",
      manualHint: "Когато е попълнено, е с предимство пред падащото меню",
      idLabel: { room: "ID на стаята в канала", rate: "ID на плана в канала" },
      idHint: { room: "ID-то на този тип стая в самия канал", rate: "ID-то на този ценови план в самия канал" },
      placeholder: "напр. 88291",
      cancel: "Отказ",
      saving: "Запазване…",
      save: "Запази съответствието",
    },
    send: {
      title: (n) => `${n === 1 ? "Един продукт никога не е стигал" : `${n} продукта никога не са стигали`} до каналния мениджър`,
      why: "Добавени са след свързването на канала, а настройката изпраща само това, което съществува в момента. Никоя OTA не ги вижда, докато не бъдат изпратени.",
      button: (n) => `Изпрати ${n}`,
      kind: { roomType: "стая", ratePlan: "цена" },
      sending: "Изпращане…",
    },
    verify: {
      lead: ["Прочетете какво публикува ", " в момента и го сравнете с нашите данни."],
      reading: "Четене…",
      button: "Провери",
      plan: (c, n) => `план в ${c} „${n}“`,
      anonymous: (id) => `Ценови план на канала ${id}…`,
      missing: (o) => `при нас ${o}, при тях нищо`,
      unexpected: (t) => `те публикуват ${t}, а Revio не управлява този план`,
      mismatch: (o, t) => `при нас ${o}, те публикуват ${t}`,
      derived: (c, p) => `${c} изчислява този план от ${p} и пренебрегва цената, която изпращаме. Направете го производен в „Стаи и цени“ със същата отстъпка или изключете изчисляването в ${c}.`,
      unmanaged: (c) => `Плановете, които Revio не управлява, пазят последната цена, зададена в ${c}. Ако някой от тях е свързан с OTA, продава на тази цена — свържете го тук или го затворете в ${c}.`,
      rooms: (h) => `Стаи: ${h}`,
      roomLine: (o, s, t) => `изпращаме ${o}${s ? " (стоп продажби за всички планове)" : ""}, те предлагат ${t ?? "нищо"}`,
      restrictions: (h) => `Ограничения: ${h}`,
      restrictionLine: (f, o, t) => {
        const show = (v: number | boolean | null) => v == null ? "нищо" : typeof v === "boolean" ? (v ? "включено" : "изключено") : (f === "maxStay" && v === 0) || (f === "minStay" && v <= 1) ? "няма" : `${v} нощувки`;
        const what = { minStay: "минимален престой", maxStay: "максимален престой", cta: "затворено за пристигане", ctd: "затворено за заминаване", stopSell: "стоп продажби" }[f];
        return `${what} — изпращаме ${show(o)}, при тях ${show(t)}`;
      },
    },
  },
};
