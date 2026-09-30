import type { Translations } from "@revio/ui/i18n";
import type { JourneyStepKey } from "@revio/core";

/**
 * RevioLink's Channels screen — the channel cards, the quick actions and their confirmations, the
 * settings and connect dialogs, and the one-time Channex set-up.
 *
 * `journey` is core's `channelJourney`, worded again by step key so it can be Bulgarian; the drift
 * test holds the English to core's, word for word. The field titles inside the Connect dialog are
 * Channex's own and stay as Channex sends them.
 */
export interface CmChannelsStrings {
  title: string;
  subtitle: string;
  modes: Record<"mock" | "channex_sandbox" | "channex_prod", string>;
  status: Record<"connected" | "paused" | "error" | "disconnected" | "pending", string>;
  notLiveYet: string;
  empty: { title: string; body: string };
  card: {
    /** `commission` null = not an OTA (Channex, the connection itself), so no commission is shown. */
    meta: (currency: string, commission: number | null, lastPush: string) => string;
    errors: (n: number) => string;
    stuck: (n: number) => string;
    pull: string;
    pullTitle: string;
    reimport: string;
    reimportStuck: (n: number) => string;
    reimportStuckTitle: (n: number) => string;
    reimportTitle: string;
    wayTo: (channel: string) => string;
    stepDone: string;
    stepNext: string;
    stepLater: string;
    mapping: string;
    health: string;
    noPushes: string;
    delivered: (pct: number, updates: number) => string;
    pending: string;
    restrictions: string;
    fxMarkup: string;
  };
  dormant: { title: string; subtitle: string; line: (lastPush: string) => string };
  journey: {
    labels: Record<JourneyStepKey, (channel: string) => string>;
    next: {
      on_channex: string;
      mapped: (left: number, total: number, channel: string) => string;
      live: (channel: string) => string;
      verified: (channel: string) => string;
      first_booking: (channel: string) => string;
    };
    actions: { mapped: string; verified: string };
  };
  actions: {
    cancel: string;
    working: string;
    pause: { label: (c: string) => string; title: (c: string) => string; confirm: string; body: (c: string) => [string, string, string] };
    resume: { label: (c: string) => string; title: (c: string) => string; confirm: string; body: (c: string) => string };
    disconnect: { label: (c: string) => string; title: (c: string) => string; confirm: string; body: (c: string) => [string, string, string] };
    reconnect: { label: (c: string) => string; title: (c: string) => string; confirm: string; body: (c: string) => string };
    fullSync: { label: (c: string) => string; title: string };
  };
  settings: {
    open: string;
    title: (c: string) => string;
    currency: string;
    currencyHint: string;
    conversion: string;
    conversions: Record<"none" | "manual" | "auto" | "channel_override", string>;
    markup: string;
    commission: string;
    rounding: string;
    roundings: Record<"none" | "end_99" | "nearest_minor_1" | "nearest_minor_50", string>;
    connectivity: string;
    connectivityHint: string;
    connectivityModes: Record<"mock" | "channex_sandbox" | "channex_prod", string>;
    uuid: string;
    uuidHint: string;
    uuidPlaceholder: string;
    cancel: string;
    saving: string;
    save: string;
  };
  add: {
    button: string;
    title: string;
    channel: string;
    allConnected: string;
    propertyId: string;
    propertyIdHint: string;
    propertyIdPlaceholder: string;
    connecting: string;
    submit: string;
  };
  connect: {
    button: string;
    title: string;
    channel: string;
    choose: string;
    asking: (channel: string) => string;
    nothingNeeded: (channel: string) => string;
    authorise: (channel: string) => string;
    checking: string;
    submit: string;
    createdOff: string;
  };
  provision: {
    title: (property: string) => string;
    body: string;
    free: string;
    working: string;
    button: string;
  };
}

const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;

export const channels: Translations<CmChannelsStrings> = {
  en: {
    title: "Channels",
    subtitle: "Connected OTAs, mapping health and per-channel settings",
    modes: { mock: "Mock", channex_sandbox: "Channex · sandbox", channex_prod: "Channex · prod" },
    status: { connected: "Connected", paused: "Paused", error: "Error", disconnected: "Disconnected", pending: "Not live yet" },
    notLiveYet:
      "Set up, but not switched on. The connection exists and the OTA is not selling through it yet — " +
      "no prices out, no bookings in. Switching it on is ours to do; tell us when you are ready and we will.",
    empty: {
      title: "No channels connected yet",
      body: "Connecting a channel is what puts your rooms on sale. Add Booking.com, Expedia or any other OTA you work with, then map your room types to their listings.",
    },
    card: {
      meta: (c, pct, last) => `${c}${pct != null ? ` · ${pct}% commission` : ""} · last push ${last}`,
      errors: (x) => `${x} error`,
      stuck: (x) => `${x} booking${x === 1 ? "" : "s"} not imported`,
      pull: "Pull bookings",
      pullTitle: "Pull new bookings from this channel",
      reimport: "Re-import bookings",
      reimportStuck: (x) => `Re-import ${x} stuck booking${x === 1 ? "" : "s"}`,
      reimportStuckTitle: (x) => `${x} booking${x === 1 ? " is" : "s are"} not in your calendar. Finish the mapping first, then press this to bring ${x === 1 ? "it" : "them"} in.`,
      reimportTitle: "Re-fetch recent bookings from the channel — use after finishing a mapping, to bring in bookings that bounced",
      wayTo: (c) => `The way to your first ${c} booking`,
      stepDone: "done",
      stepNext: "next",
      stepLater: "not yet",
      mapping: "Mapping completeness",
      health: "Connectivity health · last 24h",
      noPushes: "no pushes yet",
      delivered: (p, u) => `${p}% delivered · ${u} updates`,
      pending: "Pending",
      restrictions: "Restrictions",
      fxMarkup: "FX markup",
    },
    dormant: {
      title: "Disconnected channels",
      subtitle: "Reconnecting keeps the mapping you already did, and bookings already imported stay valid",
      line: (last) => `last push ${last} · mapping dormant`,
    },
    journey: {
      labels: {
        on_channex: () => "Your rooms and prices are set up on the channel manager",
        mapped: (c) => `Every room and rate is linked to ${c}`,
        live: (c) => `${c} is switched on and selling`,
        verified: (c) => `${c} shows the prices and rooms you set`,
        first_booking: (c) => `First booking received from ${c}`,
      },
      next: {
        on_channex: "Finish Rooms & Rates first — what exists when you set up is what the channel manager receives. Then press Set up.",
        mapped: (left, total, c) => `${left} of ${total} still need linking. Anything not linked is not on sale on ${c}, and a booking for it cannot be imported.`,
        live: (c) => `${c} has to approve the connection inside its own extranet — nobody can do that step for you. Until then no prices go out and no bookings come in. Tell us when you have approved it and we switch it on.`,
        verified: (c) => `Read back what ${c} is actually showing guests and compare it with your calendar. It takes a few seconds and catches a mapping that points at the wrong room.`,
        first_booking: (c) => `Everything is in place. The first booking arrives here within seconds of a guest booking on ${c} — no bookings yet only means nobody has booked.`,
      },
      actions: { mapped: "Finish mapping", verified: "Verify now" },
    },
    actions: {
      cancel: "Cancel",
      working: "Working…",
      pause: {
        label: (c) => `Pause ${c}`,
        title: (c) => `Pause ${c}?`,
        confirm: "Pause channel",
        body: (c) => ["This closes ", `all dates on ${c}`, " with a reversible stop-sell overlay — no bookings can arrive until you resume. Your rates and availability stay untouched, and other channels keep selling from the shared pool. Resume restores the exact prior state instantly."],
      },
      resume: {
        label: (c) => `Resume ${c}`,
        title: (c) => `Resume ${c}?`,
        confirm: "Resume selling",
        body: (c) => `Reopens ${c} by re-pushing your live availability, rates and restrictions (365 days) — the exact state from before the pause.`,
      },
      disconnect: {
        label: (c) => `Disconnect ${c}`,
        title: (c) => `Disconnect ${c}?`,
        confirm: "Disconnect",
        body: (c) => [`Stops syncing and closes ${c} out so it isn’t left selling on stale rates. Your mapping is kept `, "dormant", ` — reconnecting later never forces a re-map — and reservations already imported from ${c} are not touched.`],
      },
      reconnect: {
        label: (c) => `Reconnect ${c}`,
        title: (c) => `Reconnect ${c}?`,
        confirm: "Reconnect",
        body: (c) => `Resumes distribution on ${c} using the preserved mapping, then pushes a full 365-day sync.`,
      },
      fullSync: {
        label: (c) => `Full sync ${c}`,
        title: "Full sync — push the next 365 days of ARI to force this channel back into agreement",
      },
    },
    settings: {
      open: "Channel settings",
      title: (c) => `${c} — settings`,
      currency: "Currency",
      currencyHint: "Inherited from property",
      conversion: "Conversion",
      conversions: { none: "No conversion", manual: "Manual fixed rate", auto: "Automatic daily", channel_override: "Channel override" },
      markup: "FX markup %",
      commission: "Commission %",
      rounding: "Rounding",
      roundings: { none: "None", end_99: ".99", nearest_minor_1: "Whole", nearest_minor_50: "0.50" },
      connectivity: "Connectivity",
      connectivityHint: "Only Channex sends to the OTAs",
      connectivityModes: { mock: "Test connection", channex_sandbox: "Channex — test", channex_prod: "Channex" },
      uuid: "Channex Property UUID",
      uuidHint: "Required for Channex modes",
      uuidPlaceholder: "e.g. 4e0c…",
      cancel: "Cancel",
      saving: "Saving…",
      save: "Save settings",
    },
    add: {
      button: "Connect Channel",
      title: "Connect a channel",
      channel: "Channel",
      allConnected: "All channels already connected",
      propertyId: "Property ID on channel",
      propertyIdHint: "The OTA's id for this hotel — currency is inherited from the property",
      propertyIdPlaceholder: "e.g. 88291",
      connecting: "Connecting…",
      submit: "Connect & push",
    },
    connect: {
      button: "Connect channel",
      title: "Connect a channel",
      channel: "Channel",
      choose: "Choose…",
      asking: (c) => `Asking ${c} what it needs…`,
      nothingNeeded: (c) => `${c} needs nothing from you here — everything is handled on the Channex side.`,
      authorise: (c) => `The hotel must also authorise us inside their own ${c} extranet. We check that when you connect — if it has not been done yet, this will say so.`,
      checking: "Checking…",
      submit: "Test & connect",
      createdOff: "The channel is created switched off. Nothing goes on sale until we switch it on — tell us when your mapping is finished and you are ready to take bookings.",
    },
    provision: {
      title: (p) => `Set ${p} up for channels`,
      body: "This registers your rooms and rate plans with our distribution network so they can be sent to the OTAs. It takes about a minute, and you only do it once.",
      free: "Nothing goes on sale and nothing is charged — that happens later, when you connect and activate an actual channel.",
      working: "Setting up…",
      button: "Set up channels",
    },
  },
  bg: {
    title: "Канали",
    subtitle: "Свързани OTA, състояние на съответствията и настройки по канал",
    modes: { mock: "Тест", channex_sandbox: "Channex · тест", channex_prod: "Channex · реален" },
    status: { connected: "Свързан", paused: "На пауза", error: "Грешка", disconnected: "Откачен", pending: "Още не е активен" },
    notLiveYet:
      "Настроен, но не е включен. Връзката съществува, но OTA още не продава чрез нея — " +
      "не излизат цени и не идват резервации. Включването е наша работа; кажете ни, когато сте готови, и ще го направим.",
    empty: {
      title: "Все още няма свързани канали",
      body: "Свързването на канал пуска стаите Ви в продажба. Добавете Booking.com, Expedia или друга OTA, с която работите, после свържете типовете стаи с техните обяви.",
    },
    card: {
      meta: (c, pct, last) => `${c}${pct != null ? ` · ${pct}% комисиона` : ""} · последно изпращане ${last}`,
      errors: (x) => n(x, "грешка", "грешки"),
      stuck: (x) => `${n(x, "резервация не е внесена", "резервации не са внесени")}`,
      pull: "Изтегли резервации",
      pullTitle: "Изтегли новите резервации от този канал",
      reimport: "Внеси резервациите отново",
      reimportStuck: (x) => `Внеси отново ${n(x, "заседнала резервация", "заседнали резервации")}`,
      reimportStuckTitle: (x) => `${x === 1 ? "1 резервация не е" : `${x} резервации не са`} в календара Ви. Първо довършете съответствията, после натиснете тук, за да ${x === 1 ? "я" : "ги"} внесете.`,
      reimportTitle: "Изтегли отново последните резервации от канала — след като довършите съответствията, за да влязат отхвърлените",
      wayTo: (c) => `Пътят до първата резервация от ${c}`,
      stepDone: "готово",
      stepNext: "следва",
      stepLater: "още не",
      mapping: "Попълнени съответствия",
      health: "Състояние на връзката · последните 24 ч",
      noPushes: "още няма изпращания",
      delivered: (p, u) => `${p}% доставени · ${n(u, "промяна", "промени")}`,
      pending: "Чакащи",
      restrictions: "Ограничения",
      fxMarkup: "Валутна надбавка",
    },
    dormant: {
      title: "Откачени канали",
      subtitle: "При повторно свързване съответствията, които сте направили, се запазват, а вече внесените резервации остават валидни",
      line: (last) => `последно изпращане ${last} · съответствията са замразени`,
    },
    journey: {
      labels: {
        on_channex: () => "Стаите и цените Ви са настроени в каналния мениджър",
        mapped: (c) => `Всяка стая и цена е свързана с ${c}`,
        live: (c) => `${c} е включен и продава`,
        verified: (c) => `${c} показва цените и стаите, които сте задали`,
        first_booking: (c) => `Получена е първата резервация от ${c}`,
      },
      next: {
        on_channex: "Първо довършете „Стаи и цени“ — каналният мениджър получава това, което съществува в момента на настройката. После натиснете „Настрой каналите“.",
        mapped: (left, total, c) => `${left} от ${total} още трябва да се свържат. Каквото не е свързано, не се продава в ${c}, а резервация за него не може да бъде внесена.`,
        live: (c) => `${c} трябва да одобри връзката в собствения си екстранет — никой не може да направи тази стъпка вместо Вас. Дотогава не излизат цени и не идват резервации. Кажете ни, когато сте я одобрили, и ще я включим.`,
        verified: (c) => `Прочетете какво реално показва ${c} на гостите и го сравнете с календара си. Отнема няколко секунди и хваща съответствие, насочено към грешна стая.`,
        first_booking: (c) => `Всичко е готово. Първата резервация пристига тук секунди след като гост резервира в ${c} — липсата на резервации означава само, че още никой не е резервирал.`,
      },
      actions: { mapped: "Довърши съответствията", verified: "Провери сега" },
    },
    actions: {
      cancel: "Отказ",
      working: "Изпълнява се…",
      pause: {
        label: (c) => `Пауза на ${c}`,
        title: (c) => `Пауза на ${c}?`,
        confirm: "Пауза на канала",
        body: (c: string): [string, string, string] => ["Това затваря ", `всички дати в ${c}`, " с временно спиране на продажбите, което може да се отмени — не могат да пристигат резервации, докато не възобновите. Цените и наличността Ви не се пипат, а другите канали продължават да продават от общия капацитет. Възобновяването връща точно предишното състояние веднага."],
      },
      resume: {
        label: (c) => `Възобнови ${c}`,
        title: (c) => `Възобновяване на ${c}?`,
        confirm: "Възобнови продажбите",
        body: (c) => `Отваря отново ${c}, като изпраща текущата наличност, цени и ограничения (365 дни) — точно състоянието отпреди паузата.`,
      },
      disconnect: {
        label: (c) => `Откачи ${c}`,
        title: (c) => `Откачане на ${c}?`,
        confirm: "Откачи",
        body: (c: string): [string, string, string] => [`Спира синхронизацията и затваря ${c}, за да не остане да продава на стари цени. Съответствията Ви се запазват `, "замразени", ` — при повторно свързване не се налага да ги правите отново — а вече внесените резервации от ${c} не се пипат.`],
      },
      reconnect: {
        label: (c) => `Свържи отново ${c}`,
        title: (c) => `Повторно свързване на ${c}?`,
        confirm: "Свържи отново",
        body: (c) => `Възобновява дистрибуцията в ${c} със запазените съответствия и изпраща пълна синхронизация за 365 дни.`,
      },
      fullSync: {
        label: (c) => `Пълна синхронизация на ${c}`,
        title: "Пълна синхронизация — изпраща следващите 365 дни наличност, цени и ограничения, за да изравни канала",
      },
    },
    settings: {
      open: "Настройки на канала",
      title: (c) => `${c} — настройки`,
      currency: "Валута",
      currencyHint: "Взема се от обекта",
      conversion: "Превалутиране",
      conversions: { none: "Без превалутиране", manual: "Ръчен фиксиран курс", auto: "Автоматично всеки ден", channel_override: "Курс на канала" },
      markup: "Валутна надбавка %",
      commission: "Комисиона %",
      rounding: "Закръгляне",
      roundings: { none: "Без", end_99: ",99", nearest_minor_1: "Цяло", nearest_minor_50: "0,50" },
      connectivity: "Връзка",
      connectivityHint: "Само Channex изпраща към OTA",
      connectivityModes: { mock: "Тестова връзка", channex_sandbox: "Channex — тест", channex_prod: "Channex" },
      uuid: "UUID на обекта в Channex",
      uuidHint: "Задължително за режимите с Channex",
      uuidPlaceholder: "напр. 4e0c…",
      cancel: "Отказ",
      saving: "Запазване…",
      save: "Запази настройките",
    },
    add: {
      button: "Свържи канал",
      title: "Свързване на канал",
      channel: "Канал",
      allConnected: "Всички канали вече са свързани",
      propertyId: "ID на обекта в канала",
      propertyIdHint: "ID на хотела в OTA — валутата се взема от обекта",
      propertyIdPlaceholder: "напр. 88291",
      connecting: "Свързване…",
      submit: "Свържи и изпрати",
    },
    connect: {
      button: "Свържи канал",
      title: "Свързване на канал",
      channel: "Канал",
      choose: "Изберете…",
      asking: (c) => `Питаме ${c} какво му трябва…`,
      nothingNeeded: (c) => `${c} няма нужда от нищо от Вас тук — всичко се урежда от страна на Channex.`,
      authorise: (c) => `Хотелът трябва също да ни упълномощи в собствения си екстранет на ${c}. Проверяваме това при свързването — ако още не е направено, ще Ви кажем.`,
      checking: "Проверка…",
      submit: "Провери и свържи",
      createdOff: "Каналът се създава изключен. Нищо не се пуска в продажба, докато не го включим — кажете ни, когато съответствията са готови и искате да приемате резервации.",
    },
    provision: {
      title: (p) => `Настройте ${p} за канали`,
      body: "Това регистрира стаите и ценовите Ви планове в нашата мрежа за дистрибуция, за да могат да се изпращат към OTA. Отнема около минута и се прави само веднъж.",
      free: "Нищо не се пуска в продажба и нищо не се таксува — това става по-късно, когато свържете и активирате конкретен канал.",
      working: "Настройване…",
      button: "Настрой каналите",
    },
  },
};
