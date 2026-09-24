import type { ProductKey, SelfTrialRefusal, UpsellReasonCode } from "@revio/core";
import type { Translations } from "./i18n";

/**
 * The words about the products themselves — what each one is for, the account menu's "your
 * products" and "also available", the locked screens, and the start-a-trial page.
 *
 * **Strings only**, `{name}` placeholders filled with `fill()`: the account menu is a client component.
 *
 * ⚠️ The English sentences are also written in `@revio/core` (`productAccessCopy`,
 * `selfTrialPromises`, `canSelfStartTrial`, `UPSELL_REASON`), where they are the contract the tests
 * hold. `apps/pms/lib/i18n/product-drift.test.ts` holds this English to core's word for word, so the
 * two cannot drift. Product names are marks and are never translated.
 */
export interface ProductStrings {
  tagline: Record<ProductKey, string>;
  upsell: Record<UpsellReasonCode, string>;
  menu: {
    yourProducts: string;
    here: string;
    alsoAvailable: string;
    /** "{days}" */
    tryFree: string;
    askContact: string;
  };
  locked: {
    /** "{product}" */
    trialEndedTitle: string;
    /** "{ended}" "{hotel}" "{product}" */
    trialEndedBody: string;
    endDateFallback: string;
    /** "{product}" "{hotel}" */
    switchedOffTitle: string;
    switchedOffBody: string;
    /** "{hotel}" "{product}" */
    neverHadTitle: string;
    /** "{tagline}" "{days}" */
    neverHadBody: string;
    startTrial: string;
    /** "{product}" */
    keepRequested: string;
    stillOpen: string;
    questions: string;
    keep: string;
    keeping: string;
  };
  role: {
    /** "{product}" */
    title: string;
    bodyBefore: string;
    /** "{where}" "{product}" */
    bodyAfter: string;
    elsewhere: string;
    /** "{product}" */
    goTo: string;
    wrongAccount: string;
    signOut: string;
  };
  trial: {
    eyebrow: string;
    /** "{product}" "{days}" */
    title: string;
    promises: {
      /** "{product}" "{days}" */
      on: string;
      noCharge: string;
      noImport: string;
      /** "{days}" — a trial longer than a week is reminded a week ahead. */
      reminderWeek: string;
      reminderFew: string;
      noAuto: string;
      /** "{product}" */
      payFromDecide: string;
      separate: string;
    };
    refusal: Record<SelfTrialRefusal, string>;
    /** "{days}" */
    start: string;
    notNow: string;
    footer: string;
  };
}

export const productStrings: Translations<ProductStrings> = {
  en: {
    tagline: { cm: "Channels and availability", crs: "Reservations and rates", pms: "Front desk and housekeeping" },
    upsell: {
      "cm.withCrs": "Send the rates you already keep here straight to Booking.com and Expedia.",
      "cm.alone": "Keep your rooms and prices in step across every booking site.",
      "crs.withCm": "Your channel bookings already arrive — this is where they become a record you can report on.",
      "crs.alone": "One reservation record, with occupancy, ADR and RevPAR computed from it.",
      "pms.withCrs": "Run the arrival day on the same bookings: front desk, housekeeping and the guest's bill.",
      "pms.alone": "Front desk, housekeeping and folios on the rooms you already have here.",
    },
    menu: {
      yourProducts: "Your products",
      here: "Here",
      alsoAvailable: "Also available",
      tryFree: "Try it free for {days} days →",
      askContact: "Ask your Revio contact to switch one on.",
    },
    locked: {
      trialEndedTitle: "Your {product} trial has ended",
      trialEndedBody:
        "The trial finished on {ended}. Nothing has been deleted — every room, rate and booking for {hotel} is exactly where you left it, and switching {product} back on brings it all back. If you keep it you pay from the day you decide, never for a day of the trial.",
      endDateFallback: "its end date",
      switchedOffTitle: "{product} is switched off for {hotel}",
      switchedOffBody: "This product isn't active on your account at the moment. Your data is untouched — tell us and we'll sort it out.",
      neverHadTitle: "{hotel} doesn't have {product} yet",
      neverHadBody:
        "{tagline}. It runs on the rooms and rates you already have, so there is nothing to set up twice — try it free for {days} days, no card.",
      startTrial: "Start your free trial",
      keepRequested: "You've asked to keep {product} — we'll be in touch shortly.",
      stillOpen: "Still yours, and open right now",
      questions: "Questions?",
      keep: "I want to keep it",
      keeping: "Letting them know…",
    },
    role: {
      title: "{product} is not part of your role",
      bodyBefore: "Your account is set up as ",
      bodyAfter: ", and that role works in {where}. Ask an owner or admin at your hotel if you need {product} as well — they can change it in Settings.",
      elsewhere: "a different part of the platform",
      goTo: "Go to {product}",
      wrongAccount: "Signed in as the wrong account?",
      signOut: "Sign out",
    },
    trial: {
      eyebrow: "Free trial",
      title: "Try {product} for {days} days",
      promises: {
        on: "{product} switches on now, for {days} days.",
        noCharge: "Nothing is charged, and no card is asked for.",
        noImport: "It uses the rooms, rates and bookings you already keep here — there is nothing to import.",
        reminderWeek: "We will email you a week before it ends, and again the day before.",
        reminderFew: "We will email you a few days before it ends, and again the day before.",
        noAuto: "If you do nothing it simply switches off. Nothing is deleted, and nothing starts charging on its own.",
        payFromDecide: "If you decide to keep {product}, you pay from the day you decide — never for a day of the trial.",
        separate: "Each product is separate at the end — keep the ones you used, and pay for those alone.",
      },
      refusal: {
        not_permitted:
          "Starting a trial is the owner's or an admin's decision, because it is the account that keeps it afterwards. Ask one of them to switch {product} on.",
        suspended: "This account is suspended, so nothing new can be switched on. Talk to us and we will sort it out.",
        already_owned: "You already have {product}. A trial would take it away when it finished.",
        not_a_customer:
          "A trial runs on the rooms, rates and bookings you already keep here. Ask us for a demo and we will set you up.",
        already_trialled:
          "{product} has already been trialled on this account. If you would like another look at it, reply to any Revio email and we will arrange one.",
      },
      start: "Start the {days}-day trial",
      notNow: "Not now",
      footer:
        "No card, no contract, and no automatic renewal. If you want to keep it afterwards, reply to any Revio email and we will price it with you first.",
    },
  },
  bg: {
    tagline: { cm: "Канали и наличност", crs: "Резервации и цени", pms: "Рецепция и хаускийпинг" },
    upsell: {
      "cm.withCrs": "Изпращайте цените, които вече поддържате тук, директно към Booking.com и Expedia.",
      "cm.alone": "Поддържайте стаите и цените си еднакви във всеки сайт за резервации.",
      "crs.withCm": "Резервациите от каналите вече пристигат — тук те стават запис, по който можете да правите отчети.",
      "crs.alone": "Един запис за всяка резервация, с заетост, ADR и RevPAR, изчислени от него.",
      "pms.withCrs": "Посрещайте гостите по същите резервации: рецепция, хаускийпинг и сметката на госта.",
      "pms.alone": "Рецепция, хаускийпинг и сметки върху стаите, които вече имате тук.",
    },
    menu: {
      yourProducts: "Вашите продукти",
      here: "Тук",
      alsoAvailable: "Също на разположение",
      tryFree: "Изпробвайте безплатно за {days} дни →",
      askContact: "Помолете Вашия контакт в Revio да включи някой от тях.",
    },
    locked: {
      trialEndedTitle: "Пробният Ви период на {product} приключи",
      trialEndedBody:
        "Пробният период приключи на {ended}. Нищо не е изтрито — всяка стая, цена и резервация на {hotel} е точно там, където сте я оставили, и щом {product} бъде включен отново, всичко се връща. Ако го запазите, плащате от деня, в който решите — никога за ден от пробния период.",
      endDateFallback: "крайната си дата",
      switchedOffTitle: "{product} е изключен за {hotel}",
      switchedOffBody: "Този продукт в момента не е активен в профила Ви. Данните Ви са непокътнати — пишете ни и ще го уредим.",
      neverHadTitle: "{hotel} все още няма {product}",
      neverHadBody:
        "{tagline}. Работи върху стаите и цените, които вече имате, така че нищо не се настройва два пъти — изпробвайте го безплатно за {days} дни, без карта.",
      startTrial: "Започни безплатния пробен период",
      keepRequested: "Поискахте да запазите {product} — ще се свържем с Вас скоро.",
      stillOpen: "Все още Ваши и отворени в момента",
      questions: "Въпроси?",
      keep: "Искам да го запазя",
      keeping: "Изпращаме…",
    },
    role: {
      title: "{product} не е част от Вашата роля",
      bodyBefore: "Профилът Ви е с роля ",
      bodyAfter: " и тази роля работи в {where}. Ако Ви трябва и {product}, обърнете се към собственик или администратор във Вашия хотел — те могат да го променят от Настройки.",
      elsewhere: "друга част от платформата",
      goTo: "Към {product}",
      wrongAccount: "Влезли сте с грешен профил?",
      signOut: "Изход",
    },
    trial: {
      eyebrow: "Безплатен пробен период",
      title: "Изпробвайте {product} за {days} дни",
      promises: {
        on: "{product} се включва сега, за {days} дни.",
        noCharge: "Нищо не се таксува и не се иска карта.",
        noImport: "Използва стаите, цените и резервациите, които вече поддържате тук — няма нищо за прехвърляне.",
        reminderWeek: "Ще Ви пишем седмица преди края и още веднъж ден преди края.",
        reminderFew: "Ще Ви пишем няколко дни преди края и още веднъж ден преди края.",
        noAuto: "Ако не направите нищо, просто се изключва. Нищо не се изтрива и нищо не започва да се таксува само.",
        payFromDecide: "Ако решите да запазите {product}, плащате от деня, в който решите — никога за ден от пробния период.",
        separate: "В края всеки продукт е отделен — запазете тези, които сте ползвали, и плащате само за тях.",
      },
      refusal: {
        not_permitted:
          "Пробният период се започва от собственика или администратор, защото профилът е този, който го запазва след това. Помолете някой от тях да включи {product}.",
        suspended: "Този профил е спрян, затова не може да се включи нищо ново. Пишете ни и ще го уредим.",
        already_owned: "Вече имате {product}. Пробен период би го изключил, когато приключи.",
        not_a_customer:
          "Пробният период работи върху стаите, цените и резервациите, които вече поддържате тук. Поискайте ни демонстрация и ще Ви настроим.",
        already_trialled:
          "{product} вече е изпробван в този профил. Ако искате да го разгледате отново, отговорете на който и да е имейл от Revio и ще го уредим.",
      },
      start: "Започни {days}-дневния пробен период",
      notNow: "Не сега",
      footer:
        "Без карта, без договор и без автоматично подновяване. Ако искате да го запазите след това, отговорете на който и да е имейл от Revio и първо ще уговорим цената с Вас.",
    },
  },
};
