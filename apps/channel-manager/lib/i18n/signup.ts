import type { Translations } from "@revio/ui/i18n";
import type { SignupRefusalCode } from "@revio/core";

/**
 * The public front door — start a trial, "check your email", "you already have an account". It is
 * served from RevioLink's origin but wears the platform's name, because the account it creates owns
 * all three products. Refusals are worded by the code core and the signup write return
 * (`validateSignup`, `signupVerdict`, `createPublicSignup`); the drift test holds the English to theirs.
 */
export interface CmSignupStrings {
  meta: { start: string; sent: string; existing: string };
  hero: { tagline: string; title: string; body: string; points: [string, string, string, string]; footer: string };
  title: string;
  lead: string;
  haveAccount: string;
  signIn: string;
  form: {
    hotel: string;
    hotelPlaceholder: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    need: string;
    needs: Record<"cm" | "crs" | "pms", { need: string; detail: string }>;
    allThreeBefore: string;
    allThreeStrong: string;
    allThreeAfter: string;
    working: string;
    submit: string;
    noCard: string;
  };
  sent: {
    againTitle: string;
    title: string;
    againBody: string;
    body: string;
    againNote: (ttl: string) => string;
    note: (ttl: string) => string;
    back: string;
  };
  existing: {
    title: string;
    suspended: string;
    active: string;
    signIn: string;
    forgot: string;
    reset: string;
    other: string;
    products: Record<"cm" | "crs" | "pms", string>;
    notSure: string;
    ask: string;
  };
  /** How long the link lasts, from `TOKEN_POLICY.invite.ttlMs` — the number is core's, never typed here. */
  days: (n: number) => string;
  errors: Record<SignupRefusalCode | "disposable" | "busy" | "robot" | "mailFailed", string>;
}

export const signup: Translations<CmSignupStrings> = {
  en: {
    meta: { start: "Start your free trial · Revio", sent: "Check your email · Revio", existing: "You already have an account · Revio" },
    hero: {
      tagline: "Hotel software",
      title: "Three products. One login. One set of rooms and rates.",
      body: "Your channel manager, your reservation system and your front desk run on the same inventory — so adding the second one later is a switch, not a migration.",
      points: [
        "· 30 days, all three products, no card",
        "· Keep only the ones you use — you pay for those alone",
        "· Your own booking page — 2%, against an OTA's 15%",
        "· Set up in an afternoon, not a quarter",
      ],
      footer: "© Revio · hotel software",
    },
    title: "Start your free trial",
    lead: "Thirty days of all three Revio products. No card, no call.",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    form: {
      hotel: "Your hotel",
      hotelPlaceholder: "Hotel Cabacum Beach",
      name: "Your name",
      namePlaceholder: "Maria Ivanova",
      email: "Work email",
      emailPlaceholder: "you@yourhotel.com",
      need: "What do you need most right now?",
      needs: {
        cm: { need: "Stop the OTAs double-booking my rooms", detail: "Availability, rates and restrictions pushed to every channel, bookings pulled back." },
        crs: { need: "Take bookings direct and keep them in order", detail: "Every reservation from every source, plus your own direct booking page." },
        pms: { need: "Run the front desk and housekeeping", detail: "Check-in and out, room status, folios and the night audit." },
      },
      allThreeBefore: "You get ",
      allThreeStrong: "all three for 30 days",
      allThreeAfter: " whichever you pick — this only decides where we open first. They share one login and one set of rooms and rates, so there is nothing to move if you keep more than one. At the end you’ll keep only the ones you actually used, and pay for those alone.",
      working: "Setting things up…",
      submit: "Start my free trial",
      noCard: "No card needed. We'll email you a link to confirm your address and choose a password.",
    },
    sent: {
      againTitle: "We've sent that link again",
      title: "Check your email",
      againBody: "You had already started, so we've sent a fresh link to the same address rather than beginning again — your hotel is still there waiting. Open it to choose a password and your trial of all three products starts.",
      body: "We've sent you a link. Open it to confirm your address and choose a password — that's the last step, and your trial of all three products starts the moment you do.",
      againNote: (t) => `The earlier link no longer works. This one lasts ${t} and can be used once.`,
      note: (t) => `Nothing yet? Check the spam folder. The link works once and expires in ${t}.`,
      back: "Back to sign in",
    },
    existing: {
      title: "You already have a Revio account",
      suspended: "That email belongs to an account that is currently paused. Your data is all still there — get in touch and we will switch it back on.",
      active: "That email is already set up, so there is nothing to start — just sign in and everything is where you left it.",
      signIn: "Sign in",
      forgot: "Forgotten your password?",
      reset: "Reset it",
      other: "Signing in to a different product?",
      products: { cm: "Channels and availability", crs: "Reservations and rates", pms: "Front desk and housekeeping" },
      notSure: "Not sure which account this is?",
      ask: "Ask us",
    },
    days: (n) => `${n} day${n === 1 ? "" : "s"}`,
    errors: {
      hotel_missing: "Tell us the name of your hotel.",
      hotel_long: "That hotel name is too long — 120 characters at most.",
      owner_missing: "Tell us your name, so we know who to greet.",
      email_bad: "That email address doesn't look right.",
      intent_missing: "Pick the one thing you need most — you still get all three.",
      disposable: "That looks like a temporary email address. Use the one you actually run the hotel from — it is where your bookings and your invoices will go.",
      busy: "We're seeing an unusual number of signups right now. Try again in a few minutes, or email us and we'll set you up by hand.",
      robot: "We could not confirm that was a person. Reload the page and try once more.",
      mailFailed: "Your account is created, but we could not send the confirmation email just now. Press the button again in a moment — we will send a fresh link to the same address.",
    },
  },
  bg: {
    meta: { start: "Започнете безплатен пробен период · Revio", sent: "Проверете имейла си · Revio", existing: "Вече имате акаунт · Revio" },
    hero: {
      tagline: "Софтуер за хотели",
      title: "Три продукта. Един вход. Един набор от стаи и цени.",
      body: "Каналният мениджър, системата за резервации и рецепцията работят върху една и съща наличност — затова добавянето на втори продукт по-късно е превключване, а не миграция.",
      points: [
        "· 30 дни, и трите продукта, без карта",
        "· Запазвате само тези, които ползвате — и плащате само за тях",
        "· Собствена страница за резервации — 2% срещу 15% за OTA",
        "· Настройка за един следобед, а не за тримесечие",
      ],
      footer: "© Revio · софтуер за хотели",
    },
    title: "Започнете безплатен пробен период",
    lead: "Трийсет дни с трите продукта на Revio. Без карта, без обаждане.",
    haveAccount: "Вече имате акаунт?",
    signIn: "Вход",
    form: {
      hotel: "Вашият хотел",
      hotelPlaceholder: "Хотел Кабакум Бийч",
      name: "Вашето име",
      namePlaceholder: "Мария Иванова",
      email: "Служебен имейл",
      emailPlaceholder: "vie@vashiahotel.bg",
      need: "От какво имате най-голяма нужда в момента?",
      needs: {
        cm: { need: "OTA да спрат да продават двойно стаите ми", detail: "Наличност, цени и ограничения към всеки канал, резервациите — обратно." },
        crs: { need: "Директни резервации и ред в тях", detail: "Всяка резервация от всеки източник, плюс собствена страница за директни резервации." },
        pms: { need: "Рецепция и хаускийпинг", detail: "Настаняване и напускане, статус на стаите, фолиа и нощен одит." },
      },
      allThreeBefore: "Получавате ",
      allThreeStrong: "и трите за 30 дни",
      allThreeAfter: ", каквото и да изберете — това решава само откъде да започнем. Те ползват един вход и един набор от стаи и цени, така че няма нищо за прехвърляне, ако запазите повече от един. Накрая запазвате само тези, които реално сте ползвали, и плащате само за тях.",
      working: "Подготвяме всичко…",
      submit: "Започни безплатния пробен период",
      noCard: "Не е нужна карта. Ще Ви изпратим линк по имейл, за да потвърдите адреса си и да изберете парола.",
    },
    sent: {
      againTitle: "Изпратихме линка отново",
      title: "Проверете имейла си",
      againBody: "Вече бяхте започнали, затова изпратихме нов линк на същия адрес, вместо да започваме отначало — хотелът Ви още Ви чака. Отворете го, изберете парола и пробният период на трите продукта започва.",
      body: "Изпратихме Ви линк. Отворете го, за да потвърдите адреса си и да изберете парола — това е последната стъпка и пробният период на трите продукта започва веднага.",
      againNote: (t) => `Предишният линк вече не работи. Този е валиден ${t} и може да се използва веднъж.`,
      note: (t) => `Още нищо? Проверете папката за спам. Линкът работи веднъж и изтича след ${t}.`,
      back: "Обратно към входа",
    },
    existing: {
      title: "Вече имате акаунт в Revio",
      suspended: "Този имейл е на акаунт, който в момента е спрян. Всички данни са запазени — пишете ни и ще го включим отново.",
      active: "Този имейл вече е регистриран, така че няма какво да започвате — просто влезте и всичко е там, където сте го оставили.",
      signIn: "Вход",
      forgot: "Забравили сте паролата си?",
      reset: "Нулирайте я",
      other: "Влизате в друг продукт?",
      products: { cm: "Канали и наличност", crs: "Резервации и цени", pms: "Рецепция и хаускийпинг" },
      notSure: "Не сте сигурни кой е този акаунт?",
      ask: "Попитайте ни",
    },
    days: (n) => `${n} ${n === 1 ? "ден" : "дни"}`,
    errors: {
      hotel_missing: "Напишете името на хотела си.",
      hotel_long: "Името на хотела е твърде дълго — най-много 120 знака.",
      owner_missing: "Напишете името си, за да знаем кого да поздравим.",
      email_bad: "Този имейл адрес не изглежда правилен.",
      intent_missing: "Изберете едното нещо, от което имате най-голяма нужда — пак получавате и трите.",
      disposable: "Това изглежда като временен имейл адрес. Използвайте този, от който реално управлявате хотела — там ще отиват резервациите и фактурите Ви.",
      busy: "В момента има необичайно много регистрации. Опитайте отново след няколко минути или ни пишете и ще Ви регистрираме ръчно.",
      robot: "Не успяхме да потвърдим, че сте човек. Презаредете страницата и опитайте още веднъж.",
      mailFailed: "Акаунтът Ви е създаден, но в момента не успяхме да изпратим имейла за потвърждение. Натиснете бутона отново след малко — ще изпратим нов линк на същия адрес.",
    },
  },
};
