import type { Translations } from "@revio/ui/i18n";

/**
 * What the channel and mapping actions say when they refuse or report — `actions-config.ts` (channel
 * settings, mapping, pause, re-import) and `actions-connect.ts` (connect, set-up, send one product).
 *
 * An error Channex itself returns is passed through as Channex wrote it: it is the API's own words,
 * and rewording it would hide the detail support needs.
 */
export interface ChannelErrorStrings {
  pickChannel: string;
  alreadyConnected: (channel: string) => string;
  unknownChannel: string;
  unknownCode: (code: string) => string;
  channexUnknownCode: (code: string) => string;
  notOnChannexYet: string;
  notOnChannexAddFirst: string;
  noChannexPropertyId: string;
  stillNeeded: (fields: string) => string;
  notAccepted: (channel: string, apiMessage: string) => string;
  notConfirmed: string;
  realChannelNoAutofix: (channel: string) => string;
  mapping: {
    rowNotLinked: string;
    noChannel: string;
    roomGone: string;
    planGone: string;
    notFound: string;
  };
  reimport: {
    choose: string;
    failed: (why: string) => string;
    noAnswer: string;
    stillUnmapped: (brought: number, stuck: number) => string;
    nothingNew: string;
    brought: (fresh: number, updated: number) => string;
  };
  provision: {
    unreadable: string;
    demo: string;
    notEnabled: string;
    already: string;
    /** Setup worked; the first send of the calendar did not. */
    pushFailed: (why: string) => string;
    /** Keyed by `ProvisionRefusal` in @revio/connectivity. */
    refusal: Record<"no_key" | "no_rooms" | "no_rates" | "all_derived" | "duplicate" | "refused", string>;
  };
  send: {
    kind: string;
    nothing: string;
    noChannel: string;
    channelGone: string;
    setUpFirst: string;
    demoChannel: string;
    notSetUp: string;
    noKey: string;
  };
  catchup: {
    sent: (n: number) => string;
    adopted: (n: number) => string;
    skipped: (n: number, detail: string) => string;
    nothing: string;
  };
  verify: {
    notHere: string;
    demo: (channel: string) => string;
    couldNotRead: string;
    couldNotReadRooms: string;
    prices: {
      nothing: string;
      exact: (matched: number) => string;
      mismatched: (n: number) => string;
      missing: (n: number) => string;
      unexpected: (n: number) => string;
      /** Prices on a plan we map to that the channel calculates itself — sent, and thrown away. */
      ignored: (n: number) => string;
    };
    rooms: {
      nothing: string;
      exact: (checked: number) => string;
      off: (mismatched: number, checked: number) => string;
    };
    couldNotReadRestrictions: string;
    restrictions: {
      nothing: string;
      exact: (checked: number) => string;
      off: (nights: number, checked: number) => string;
    };
    /** Prices on plans the channel calculates itself — seen, and deliberately not counted. */
    followers: (n: number, channel: string) => string;
  };
}

export const channelErrors: Translations<ChannelErrorStrings> = {
  en: {
    pickChannel: "Pick a channel.",
    alreadyConnected: (c) => `${c} is already connected.`,
    unknownChannel: "Unknown channel.",
    unknownCode: (c) => `Unknown channel code "${c}".`,
    channexUnknownCode: (c) => `Channex does not recognise the channel code "${c}".`,
    notOnChannexYet: "This property is not connected to Channex yet.",
    notOnChannexAddFirst: "This property is not connected to Channex yet. It needs a Channex property before a channel can be added.",
    noChannexPropertyId: "This property has no Channex property id.",
    stillNeeded: (f) => `Still needed: ${f}.`,
    notAccepted: (c, m) => `${c} did not accept these details. The usual cause is that the hotel has not yet authorised us in their ${c} extranet. — ${m}`,
    notConfirmed: "The channel did not confirm the change.",
    realChannelNoAutofix: (c) => `${c} is a real channel, so its ids have to come from Channex — a made-up one would push to nothing. Use Re-pull products, then map each room's rate plans from the list.`,
    mapping: {
      rowNotLinked: "That row is not linked to a room type or rate plan. Reload the page.",
      noChannel: "No connected channel to map against. Connect one first.",
      roomGone: "That room type no longer exists.",
      planGone: "That rate plan no longer exists.",
      notFound: "Mapping not found.",
    },
    reimport: {
      choose: "Choose a channel to re-import from.",
      failed: (w) => `Could not re-import: ${w}.`,
      noAnswer: "the channel did not answer",
      stillUnmapped: (b, s) => `${b} booking(s) brought in. ${s} still reference a room or rate that is not mapped — finish those in Mapping and run this again.`,
      nothingNew: "Nothing new to bring in — every booking the channel has is already here.",
      brought: (f, u) => `${f} new and ${u} updated booking(s) brought in.`,
    },
    provision: {
      unreadable: "Could not read this hotel.",
      demo: "This is a demo hotel. A real Channex property must never point at demo data.",
      notEnabled: "RevioLink is not enabled for this hotel.",
      already: "This property is already on Channex. If setup stopped part-way, finish it in Mapping — running setup again would create a second property in Channex that nobody can tell apart.",
      pushFailed: (w) => `Your rooms and prices are set up on the channel manager, but the first send of your calendar did not go through (${w}). Nothing is on sale yet. It is sent again with your next change — or see why under Sync Center.`,
      refusal: {
        no_key: "Channel connections are not switched on for your account yet. That is on our side, not yours — we have been told, and you can also write to support@reviosoft.app. Nothing has been sent anywhere.",
        no_rooms: "Add your room types first (Rooms & Rates) — the channels need them before anything else.",
        no_rates: "Add at least one rate plan first (Rooms & Rates) — without one there is no price to sell.",
        all_derived: "Every rate plan here takes its price from another plan. Give at least one plan its own prices (Rooms & Rates), then try again.",
        duplicate: "The channel manager already has a property with this hotel's name — probably from an earlier attempt. Please do not press again: that would create a second one. We have been told and will connect the right one; you can also write to support@reviosoft.app.",
        refused: "The channel manager did not accept the setup. Nothing is on sale and nothing was charged. We have been told and will look at it; you can also write to support@reviosoft.app.",
      },
    },
    send: {
      kind: "Say whether this is a room type or a rate plan.",
      nothing: "Nothing was selected to send.",
      noChannel: "No channel was named — reload the page and try again.",
      channelGone: "That channel no longer exists — reload the page.",
      setUpFirst: "This property is not on Channex yet — use “Set up on Channex” first, and everything you have now goes in one pass.",
      demoChannel: "This is a demo channel, so there is nothing on the other side to send it to.",
      notSetUp: "This hotel is not on Channex yet — run setup on the Channels screen first.",
      noKey: "Channel connections are not switched on for your account yet. That is on our side, not yours — write to support@reviosoft.app and we will sort it out. Nothing was sent.",
    },
    catchup: {
      sent: (n) => `${n} sent to your channel manager`,
      adopted: (n) => `${n} already existed and ${n === 1 ? "was" : "were"} linked`,
      skipped: (n, d) => `${n} skipped (${d})`,
      nothing: "Nothing to send.",
    },
    verify: {
      notHere: "That channel is not on this property.",
      demo: (c) => `${c} is a demo channel — it reads back whatever we sent it, so a green result would prove nothing. Verification is for real channels.`,
      couldNotRead: "Could not read the channel.",
      couldNotReadRooms: "Could not read room counts.",
      prices: {
        nothing: "Nothing to check — no prices are mapped for these dates yet.",
        exact: (m) => `The channel is publishing exactly what we sent, on all ${m} checked.`,
        mismatched: (n) => `${n} published at a different price`,
        missing: (n) => `${n} never arrived`,
        unexpected: (n) => `${n} published that we did not send`,
        ignored: (n) => `${n} ignored by the channel, which calculates that plan itself`,
      },
      rooms: {
        nothing: "No mapped rooms to check.",
        exact: (c) => `Every room count matches, on all ${c} room-nights checked.`,
        off: (m, c) => `${m} of ${c} room-nights offered at a different count than we send.`,
      },
      couldNotReadRestrictions: "Could not read restrictions.",
      restrictions: {
        nothing: "No restrictions to check.",
        exact: (c) => `Every restriction matches — minimum and maximum stay, closed to arrival and departure, stop-sell — on all ${c} rate-plan nights checked.`,
        off: (n, c) => `${n} of ${c} rate-plan nights have restrictions different from what we send.`,
      },
      followers: (n, c) => `${n} price${n === 1 ? "" : "s"} on plans ${c} calculates from another plan were not counted — they follow that plan by themselves. The list at the bottom of this page shows where each plan's price comes from.`,
    },
  },
  bg: {
    pickChannel: "Изберете канал.",
    alreadyConnected: (c) => `${c} вече е свързан.`,
    unknownChannel: "Непознат канал.",
    unknownCode: (c) => `Непознат код на канал „${c}“.`,
    channexUnknownCode: (c) => `Channex не разпознава кода на канал „${c}“.`,
    notOnChannexYet: "Този обект още не е свързан с Channex.",
    notOnChannexAddFirst: "Този обект още не е свързан с Channex. Трябва му обект в Channex, преди да се добави канал.",
    noChannexPropertyId: "Този обект няма ID на обект в Channex.",
    stillNeeded: (f) => `Още трябва: ${f}.`,
    notAccepted: (c, m) => `${c} не прие тези данни. Обичайната причина е, че хотелът още не ни е упълномощил в екстранета на ${c}. — ${m}`,
    notConfirmed: "Каналът не потвърди промяната.",
    realChannelNoAutofix: (c) => `${c} е реален канал, затова ID-тата му трябва да идват от Channex — измислено ID би изпращало в нищото. Използвайте „Изтегли продуктите отново“, после свържете ценовите планове на всяка стая от списъка.`,
    mapping: {
      rowNotLinked: "Този ред не е свързан с тип стая или ценови план. Презаредете страницата.",
      noChannel: "Няма свързан канал, с който да се направи съответствие. Първо свържете канал.",
      roomGone: "Този тип стая вече не съществува.",
      planGone: "Този ценови план вече не съществува.",
      notFound: "Съответствието не е намерено.",
    },
    reimport: {
      choose: "Изберете канал, от който да се внесе отново.",
      failed: (w) => `Повторното внасяне не успя: ${w}.`,
      noAnswer: "каналът не отговори",
      stillUnmapped: (b, s) => `Внесени резервации: ${b}. ${s} все още сочат към стая или цена без съответствие — довършете ги в „Съответствия“ и пуснете това отново.`,
      nothingNew: "Няма нищо ново за внасяне — всяка резервация от канала вече е тук.",
      brought: (f, u) => `Внесени резервации: ${f} нови и ${u} променени.`,
    },
    provision: {
      unreadable: "Данните на хотела не можаха да бъдат прочетени.",
      demo: "Това е демо хотел. Реален обект в Channex никога не бива да сочи към демо данни.",
      notEnabled: "RevioLink не е включен за този хотел.",
      already: "Този обект вече е в Channex. Ако настройката е спряла по средата, довършете я в „Съответствия“ — повторна настройка би създала втори обект в Channex, който никой не може да различи.",
      pushFailed: (w) => `Стаите и цените Ви са настроени в каналния мениджър, но първото изпращане на календара не мина (${w}). Още нищо не се продава. Изпраща се отново при следващата Ви промяна — или вижте защо в „Синхронизация“.`,
      refusal: {
        no_key: "Връзката с каналите още не е включена за Вашия профил. Това е от наша страна, не от Ваша — уведомени сме, а можете да пишете и на support@reviosoft.app. Нищо не е изпратено никъде.",
        no_rooms: "Първо добавете типовете стаи („Стаи и цени“) — каналите имат нужда от тях преди всичко друго.",
        no_rates: "Първо добавете поне един ценови план („Стаи и цени“) — без него няма цена, която да се продава.",
        all_derived: "Всеки ценови план тук взема цената си от друг план. Дайте поне на един план собствени цени („Стаи и цени“) и опитайте отново.",
        duplicate: "В каналния мениджър вече има обект с името на този хотел — вероятно от по-ранен опит. Моля, не натискайте отново: това би създало втори. Уведомени сме и ще свържем правилния; можете да пишете и на support@reviosoft.app.",
        refused: "Каналният мениджър не прие настройката. Нищо не се продава и нищо не е таксувано. Уведомени сме и ще проверим; можете да пишете и на support@reviosoft.app.",
      },
    },
    send: {
      kind: "Посочете дали е тип стая или ценови план.",
      nothing: "Не е избрано нищо за изпращане.",
      noChannel: "Не е посочен канал — презаредете страницата и опитайте отново.",
      channelGone: "Този канал вече не съществува — презаредете страницата.",
      setUpFirst: "Този обект още не е в Channex — първо използвайте „Настрой каналите“, и всичко, което имате сега, ще отиде наведнъж.",
      demoChannel: "Това е демо канал, така че от другата страна няма къде да се изпрати.",
      notSetUp: "Този хотел още не е в Channex — първо пуснете настройката от екрана „Канали“.",
      noKey: "Връзката с каналите още не е включена за Вашия профил. Това е от наша страна, не от Ваша — пишете на support@reviosoft.app и ще я уредим. Нищо не е изпратено.",
    },
    catchup: {
      sent: (n) => `${n} ${n === 1 ? "изпратен" : "изпратени"} към каналния мениджър`,
      adopted: (n) => `${n} вече ${n === 1 ? "съществуваше и беше свързан" : "съществуваха и бяха свързани"}`,
      skipped: (n, d) => `${n} ${n === 1 ? "пропуснат" : "пропуснати"} (${d})`,
      nothing: "Няма нищо за изпращане.",
    },
    verify: {
      notHere: "Този канал не е към този обект.",
      demo: (c) => `${c} е демо канал — връща обратно каквото сме му изпратили, така че зелен резултат не доказва нищо. Проверката е за реални канали.`,
      couldNotRead: "Каналът не можа да бъде прочетен.",
      couldNotReadRooms: "Броят стаи не можа да бъде прочетен.",
      prices: {
        nothing: "Няма какво да се провери — за тези дати още няма цени със съответствие.",
        exact: (m) => `Каналът публикува точно това, което изпратихме — проверени: ${m}.`,
        mismatched: (n) => `${n} публикувани на различна цена`,
        missing: (n) => `${n} не са пристигнали`,
        unexpected: (n) => `${n} публикувани, без да сме ги изпратили`,
        ignored: (n) => `${n} се пренебрегват от канала, защото той сам изчислява плана`,
      },
      rooms: {
        nothing: "Няма стаи със съответствие за проверка.",
        exact: (c) => `Броят стаи съвпада навсякъде — проверени нощувки: ${c}.`,
        off: (m, c) => `${m} от ${c} нощувки се предлагат с различен брой от този, който изпращаме.`,
      },
      couldNotReadRestrictions: "Ограниченията не можаха да бъдат прочетени.",
      restrictions: {
        nothing: "Няма ограничения за проверка.",
        exact: (c) => `Всички ограничения съвпадат — минимален и максимален престой, затворено за пристигане и заминаване, стоп продажби — проверени нощувки по планове: ${c}.`,
        off: (n, c) => `${n} от ${c} нощувки по планове имат ограничения, различни от изпратените.`,
      },
      followers: (n, c) => `${n} ${n === 1 ? "цена" : "цени"} по планове, които ${c} изчислява от друг план, не са броени — те следват този план сами. Списъкът в края на страницата показва откъде идва цената на всеки план.`,
    },
  },
};
