import type { Translations } from "./i18n";

type Article = { question: string; answer: string };

/**
 * Help and "Your requests" — the same screens in all three staff products. **Strings only**
 * (`{name}` placeholders): the help centre and the reply box are client components.
 *
 * The articles themselves are written in English in `@revio/core` (`HELP_ARTICLES`), which also
 * decides which product and screen each belongs to. `articles` says them in another language, keyed
 * by the article's stable id — never by its English question. An article with no entry here shows in
 * English, which is the platform's rule for a missing translation.
 */
export interface HelpStrings {
  nav: { aria: string; help: string; helpBlurb: string; requests: string; requestsBlurb: string };
  /** "{n} open" beside "Your requests" */
  openOne: string;
  openCount: string;
  title: string;
  /** "{product} — how things work and where to find them." */
  intro: string;
  searchLabel: string;
  searchPlaceholder: string;
  noMatchTitle: string;
  noMatchBody: string;
  answerOne: string;
  /** "{n} answers" */
  answerMany: string;
  notHere: string;
  getHelp: string;
  categories: Record<"where" | "how" | "understand" | "trouble", { label: string; blurb: string }>;
  articles: Record<string, Article>;
  requests: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBefore: string;
    emptyAfter: string;
    withRevio: string;
    answered: string;
    pick: string;
    back: string;
    /** "Opened {date} by {name}" */
    opened: string;
    via: string;
    waiting: string;
    notFound: string;
    /** Keyed by `SupportSource` in core. */
    sources: Record<string, string>;
  };
  thread: { today: string; yesterday: string; revio: string; notSent: string };
  reply: { label: string; placeholder: string; sending: string; send: string; sent: string };
}

export const helpStrings: Translations<HelpStrings> = {
  en: {
    nav: {
      aria: "Help sections",
      help: "Help",
      helpBlurb: "How things work and where to find them",
      requests: "Your requests",
      requestsBlurb: "Everything you have asked us, and what we said back",
    },
    openOne: "1 open",
    openCount: "{n} open",
    title: "Help",
    intro: "{product} — how things work and where to find them.",
    searchLabel: "Search help",
    searchPlaceholder: "Search — try “price”, “stop sell”, “check out”",
    noMatchTitle: "Nothing here matches that.",
    noMatchBody: "That is a gap in our help rather than a bad question. Use Get help in the menu under your name — it reaches a person, and it tells us what to write next.",
    answerOne: "1 answer",
    answerMany: "{n} answers",
    notHere: "Not here?",
    getHelp: "Get help in the menu under your name sends it to us with the screen you are on already attached.",
    categories: {
      where: { label: "Where do I find…", blurb: "Which screen holds which setting" },
      how: { label: "How do I…", blurb: "Doing a thing, step by step" },
      understand: { label: "What does this mean?", blurb: "Numbers, statuses and words we use" },
      trouble: { label: "It is not working", blurb: "When something looks wrong" },
    },
    articles: {},
    requests: {
      title: "Your requests",
      subtitle: "Everything you have asked us, and what we said back",
      emptyTitle: "You have not asked us anything yet",
      emptyBefore: "Use",
      emptyAfter: "in the menu under your name. We can already see which hotel and which screen you are on, so you only have to say what went wrong — and everything you send, and everything we answer, stays here.",
      withRevio: "With Revio",
      answered: "Answered",
      pick: "Choose a request on the left to read the conversation.",
      back: "All requests",
      opened: "Opened {date} by {name}",
      via: "via {source}",
      waiting: "We have your reply —",
      notFound: "That request is not one of yours, or it no longer exists.",
      sources: { app: "Asked in the app", phone: "Logged from a call", email: "Logged from an email", meeting: "Logged from a conversation" },
    },
    thread: { today: "Today", yesterday: "Yesterday", revio: "Revio", notSent: "the email did not send" },
    reply: {
      label: "Reply to this request",
      placeholder: "Add to this request…",
      sending: "Sending…",
      send: "Send",
      sent: "Sent — this request is open again.",
    },
  },
  bg: {
    nav: {
      aria: "Раздели на помощта",
      help: "Помощ",
      helpBlurb: "Как работят нещата и къде да ги намерите",
      requests: "Вашите запитвания",
      requestsBlurb: "Всичко, което сте ни питали, и какво сме отговорили",
    },
    openOne: "1 отворено",
    openCount: "{n} отворени",
    title: "Помощ",
    intro: "{product} — как работят нещата и къде да ги намерите.",
    searchLabel: "Търсене в помощта",
    searchPlaceholder: "Търсене — например „цена“, „спиране на продажби“, „напускане“",
    noMatchTitle: "Нищо тук не отговаря на това.",
    noMatchBody: "Това е пропуск в помощта ни, а не лош въпрос. Използвайте „Помощ“ в менюто под името си — тя стига до човек и ни казва какво да напишем следващо.",
    answerOne: "1 отговор",
    answerMany: "{n} отговора",
    notHere: "Няма го тук?",
    getHelp: "„Помощ“ в менюто под името Ви ни го изпраща заедно с екрана, на който сте.",
    categories: {
      where: { label: "Къде да намеря…", blurb: "Кой екран съдържа коя настройка" },
      how: { label: "Как да…", blurb: "Как се прави нещо, стъпка по стъпка" },
      understand: { label: "Какво означава това?", blurb: "Числа, статуси и думи, които използваме" },
      trouble: { label: "Нещо не работи", blurb: "Когато нещо изглежда грешно" },
    },
    articles: {
      "where-prices": {
        question: "Къде да променя цените си?",
        answer: "RevioCRS → „Стаи и цени“ задава цената на тип стая в ценови план. В „Цени и ограничения“ променяте много дни наведнъж, а масовата промяна на цени и наличност е най-бързият начин да промените цял сезон.\n\nЦената, която зададете тук, е цената навсякъде: страницата за директни резервации, каналите и отчетите четат една и съща стойност. Няма отделна „цена за канала“, която да поддържате в синхрон.",
      },
      "where-checkin-times": {
        question: "Къде да задам часовете за настаняване и напускане?",
        answer: "RevioCRS → Настройки → Обект ги показва. Самият профил на обекта — име, часова зона, валута и тези часове — се редактира в RevioLink → Настройки, защото това е един обект, общ за всички продукти, които ползвате.",
      },
      "where-staff": {
        question: "Къде да добавя човек към екипа си?",
        answer: "В RevioPMS — „Персонал и достъп“; в RevioLink и RevioCRS — Настройки → Потребители и права. Добавете човека, изберете ролята му и той ще получи покана да зададе собствена парола.\n\nНикой в Revio никога не знае и не задава парола и никой не споделя такава. Един и същ вход работи във всеки продукт на Revio, който хотелът Ви ползва, така че човекът, когото добавите тук, може да отвори всички тях.",
      },
      "where-booking-page": {
        question: "Къде да променя как изглежда страницата ми за директни резервации?",
        answer: "RevioCRS → „Система за директни резервации“. Цветът, логото и снимката зад заглавието се задават там, а страницата може да се включва и изключва за всеки обект.\n\nИзмерваме контраста на белия текст върху Вашата снимка и не позволяваме да падне под четимия минимум — екранът Ви показва числото, вместо тихо да промени избора Ви.",
      },
      "where-taxes": {
        question: "Къде да задам данъците и туристическия данък?",
        answer: "RevioCRS → Настройки → Данъци и такси. Каквото добавите там, се прилага към престоя и се показва на госта, така че първата цена, която гостът вижда на страницата за директни резервации, е цената, която плаща.",
      },
      "how-stop-selling": {
        question: "Как да спра продажбата на стая за определени дати?",
        answer: "Използвайте „Спиране на продажби“ в календара на наличността за тези дати. Така към всички канали се изпраща нулева наличност, без да се променя колко стаи всъщност имате, и нищо не се губи, когато го махнете.\n\nИзползвайте го вместо да слагате броя стаи на нула: броят е това, което притежавате, а спирането на продажби е решение за продажбата. Разделянето им позволява да отмените едното, без да загубите другото.",
      },
      "how-cancel": {
        question: "Как да анулирам или променя резервация?",
        answer: "Отворете резервацията в RevioCRS → Резервации и използвайте „Промяна“ или „Анулиране“. Стаите се връщат в продажба веднага, а каналите се обновяват сами — няма нищо за изпращане на ръка.\n\nАко някой вече чака в листата за тези дати, следващата проверка автоматично ще му предложи освободената стая.",
      },
      "how-switch-product": {
        question: "Как да минавам между RevioLink, RevioCRS и RevioPMS?",
        answer: "Щракнете върху името си горе вдясно. Менюто показва всеки продукт на хотела Ви, а превключването е с едно щракване — един и същ вход работи във всички.\n\nАко даден продукт не е в списъка, хотелът Ви не го е включил. Менюто показва какво би направил за Вас, а контактът Ви в Revio може да го включи: стаите, цените и гостите Ви вече са там, така че няма нищо за прехвърляне.",
      },
      "understand-adr-revpar": {
        question: "Какво означават заетост, ADR и RevPAR тук?",
        answer: "Заетостта е делът на продадените от наличните за продажба нощувки. ADR е средната цена на продадените нощувки. RevPAR е приходът, разделен на всички нощувки, които сте имали, продадени или не — затова пада и когато продавате по-малко стаи, и когато ги продавате по-евтино.\n\nТаблото и отчетите използват едни и същи изчисления, така че двата екрана не могат да се разминат.",
      },
      "understand-hold": {
        question: "Какво е задържане?",
        answer: "Кратко запазване на стая, докато някой решава — гост по средата на страницата за директни резервации или стая, която пазите по време на телефонен разговор. То сваля стаята от продажба, за да не бъде продадена два пъти.\n\nЗадържанията изтичат сами и стаята се връща в продажба, без никой да прави нищо.",
      },
      "understand-departed": {
        question: "Защо напуснал гост все още се показва като продадена стая?",
        answer: "Защото е продадена. Приключилият престой продължава да се брои към заетостта и прихода за нощта — гостът е напуснал, но стаята не е била свободна за никой друг тази нощ.\n\nРецепцията го показва като напуснал. Търговските данни запазват продажбата — затова и миналомесечните числа остават верни.",
      },
      "understand-commission-avoided": {
        question: "Какво е „спестена комисиона“ на екрана за цената на дистрибуцията?",
        answer: "Платената комисиона е факт: комисионата на всеки канал, приложена към прихода, който той реално Ви е донесъл.\n\nСпестената комисиона е сравнение — колко биха Ви стрували директните резервации, ако бяха дошли през OTA. Показваме я само когато можем да я изчислим от Вашите комисиони по каналите, и я оставяме празна, вместо да гадаем, когато не можем.",
      },
      "trouble-not-on-booking-com": {
        question: "Стая не се показва в Booking.com. Какво да проверя?",
        answer: "Три неща, в този ред.\n\nПърво, спряна ли е продажбата или е изцяло заета за тези дати? Проверете календара на наличността.\n\nВторо, свързана ли е стаята? RevioLink → Свързване трябва да показва типа стая и ценовите му планове като завършени. Тип стая, добавен след първото свързване на канала, трябва да бъде свързан, преди каквото и да е за него да бъде изпратено.\n\nТрето, вижте RevioLink → Синхронизация за този канал. Ако там има грешка, изпратете ни нея — съобщението ни казва много повече от „не се показва“.",
      },
      "trouble-never-synced": {
        question: "Канал показва „Никога не е синхронизиран“ или „Не се синхронизира“. Какво означава това?",
        answer: "Означава, че нищо не е стигнало успешно до този канал — а не че нищо не е опитано. Нарочно измерваме последната успешна синхронизация, а не последния опит, защото канал, който се проваля на всеки няколко минути, има съвсем скорошен опит и е напълно счупен.\n\nЗатова го приемете сериозно. Отворете „Синхронизация“ за канала и ни изпратете какво казва грешката.",
      },
      "trouble-cannot-check-out": {
        question: "Защо не мога да освободя гост?",
        answer: "Обикновено има неплатена сума в сметката. Напускането е блокирано, докато има неуредено салдо, за да не излезе гост по невнимание с отворена сметка.\n\nОтворете сметката, уредете или отпишете салдото с причина и напускането ще продължи. Ако някое начисление е грешно, анулирайте го, вместо да го изтривате, така че корекцията да остане записана.",
      },
      "trouble-page-updated": {
        question: "Видях съобщение, че страницата току-що е обновена. Изгубих ли нещо?",
        answer: "Не. Това означава, че сме пуснали нова версия, докато разделът Ви е бил отворен, и той е работил със старата. Презареждането зарежда новата.\n\nНищо вече запазено не е засегнато. Ако сте били по средата на писане на нещо незапазено, само то си струва да бъде въведено отново.",
      },
    },
    requests: {
      title: "Вашите запитвания",
      subtitle: "Всичко, което сте ни питали, и какво сме отговорили",
      emptyTitle: "Все още не сте ни питали нищо",
      emptyBefore: "Използвайте",
      emptyAfter: "в менюто под името си. Вече виждаме в кой хотел и на кой екран сте, така че трябва само да кажете какво се е объркало — а всичко, което изпратите, и всичко, което отговорим, остава тук.",
      withRevio: "При Revio",
      answered: "Отговорено",
      pick: "Изберете запитване вляво, за да прочетете разговора.",
      back: "Всички запитвания",
      opened: "Отворено на {date} от {name}",
      via: "чрез {source}",
      waiting: "Получихме отговора Ви —",
      notFound: "Това запитване не е Ваше или вече не съществува.",
      sources: { app: "Зададено в системата", phone: "Записано от разговор по телефона", email: "Записано от имейл", meeting: "Записано от среща" },
    },
    thread: { today: "Днес", yesterday: "Вчера", revio: "Revio", notSent: "имейлът не беше изпратен" },
    reply: {
      label: "Отговор към това запитване",
      placeholder: "Добавете към запитването…",
      sending: "Изпращане…",
      send: "Изпрати",
      sent: "Изпратено — запитването отново е отворено.",
    },
  },
};

/**
 * The two sections down the side of Help, the same in every product. "Your requests" carries the
 * count and, when we owe an answer or have just given one, how many are open — said in the nav, so it
 * is read without opening anything.
 */
export function helpSections(
  t: HelpStrings,
  counts: { total: number; open: number },
): { href: string; label: string; blurb: string; prefix?: boolean; badge?: string }[] {
  return [
    { href: "/help", label: t.nav.help, blurb: t.nav.helpBlurb },
    {
      href: "/help/requests",
      label: counts.total > 0 ? `${t.nav.requests} (${counts.total})` : t.nav.requests,
      blurb: t.nav.requestsBlurb,
      prefix: true,
      ...(counts.open > 0 ? { badge: counts.open === 1 ? t.openOne : t.openCount.replace("{n}", String(counts.open)) } : {}),
    },
  ];
}
