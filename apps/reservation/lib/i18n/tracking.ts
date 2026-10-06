import type { Translations } from "@revio/ui/i18n";

/** RevioCRS → Booking Engine → Analytics & ads: the hotel's own GA4 and Meta pixel on its booking page. */
export interface TrackingStrings {
  nav: string; navBlurb: string;
  title: string; subtitle: string;
  ga4: string; ga4Hint: string; ga4Placeholder: string;
  meta: string; metaHint: string; metaPlaceholder: string;
  save: string; saving: string;
  consentTitle: string; consentBody: string;
  purchaseTitle: string; purchaseBody: string;
  state: { off: string; on: (what: string) => string };
  errors: { ga4: string; meta: string };
  saved: string;
}

export const tracking: Translations<TrackingStrings> = {
  en: {
    nav: "Analytics & ads", navBlurb: "Your Google Analytics and Meta pixel on your booking page",
    title: "Your analytics and ad tags",
    subtitle: "Measure your booking page in your own Google Analytics, and let your Meta ads count the bookings they bring. The data goes to your accounts, not to us.",
    ga4: "Google Analytics 4 — Measurement ID", ga4Hint: "Google Analytics → Admin → Data streams → your web stream. It starts with G-.", ga4Placeholder: "G-XXXXXXXXXX",
    meta: "Meta pixel ID", metaHint: "Meta Events Manager → Data sources → your pixel. Digits only.", metaPlaceholder: "123456789012345",
    save: "Save", saving: "Saving…",
    consentTitle: "Guests are asked first",
    consentBody: "As soon as one of these is set, your booking page asks each guest for consent — Accept and Decline side by side, as the law requires — and loads nothing from Google or Meta until they accept. With neither set, no banner appears: there is nothing to ask about.",
    purchaseTitle: "Bookings are counted",
    purchaseBody: "When a guest who accepted completes a booking, your tags receive one purchase event: the booking reference, the total and the currency. Never the guest's name, email or phone.",
    state: { off: "Nothing is loaded on your booking page and no consent banner is shown.", on: (w) => `On your booking page after consent: ${w}.` },
    errors: { ga4: "That is not a Google Analytics 4 Measurement ID — it starts with G-, e.g. G-AB12CD34EF.", meta: "A Meta pixel ID is digits only, e.g. 123456789012345." },
    saved: "Saved. Your booking page now asks guests before loading these.",
  },
  bg: {
    nav: "Анализи и реклама", navBlurb: "Вашите Google Analytics и Meta pixel на страницата за резервации",
    title: "Вашите кодове за анализи и реклама",
    subtitle: "Измервайте страницата си за резервации в собствения си Google Analytics и позволете на рекламите си в Meta да отчитат резервациите, които носят. Данните отиват във Вашите профили, не при нас.",
    ga4: "Google Analytics 4 — Measurement ID", ga4Hint: "Google Analytics → Администриране → Потоци от данни → Вашият уеб поток. Започва с G-.", ga4Placeholder: "G-XXXXXXXXXX",
    meta: "Meta pixel ID", metaHint: "Meta Events Manager → Източници на данни → Вашият pixel. Само цифри.", metaPlaceholder: "123456789012345",
    save: "Запази", saving: "Записване…",
    consentTitle: "Гостите се питат първо",
    consentBody: "Щом въведете някое от двете, страницата за резервации пита всеки гост за съгласие — „Приемам“ и „Отказвам“ един до друг, както изисква законът — и не зарежда нищо от Google или Meta, докато гостът не приеме. Без въведен код банер няма — няма за какво да се пита.",
    purchaseTitle: "Резервациите се отчитат",
    purchaseBody: "Когато гост, който е приел, завърши резервация, кодовете Ви получават едно събитие „покупка“: номера на резервацията, сумата и валутата. Никога името, имейла или телефона на госта.",
    state: { off: "На страницата за резервации не се зарежда нищо и не се показва банер за бисквитки.", on: (w) => `На страницата за резервации след съгласие: ${w}.` },
    errors: { ga4: "Това не е Measurement ID на Google Analytics 4 — започва с G-, например G-AB12CD34EF.", meta: "Meta pixel ID е само цифри, например 123456789012345." },
    saved: "Записано. Страницата за резервации вече пита гостите, преди да ги зареди.",
  },
};
