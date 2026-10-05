import type { Translations } from "@revio/ui/i18n";

export interface RatingsStrings {
  nav: string; navBlurb: string;
  title: string; subtitle: string;
  sources: { booking: string; google: string };
  scale: { booking: string; google: string };
  score: string; count: string; url: string; urlHint: { booking: string; google: string };
  save: string; saving: string; remove: string;
  confirmed: (date: string) => string; notSet: string;
  hidden: { low: string; stale: string };
  errors: { score: (scale: string) => string; url: string };
  saved: (source: string) => string; removed: (source: string) => string;
  why: string;
}

export const ratings: Translations<RatingsStrings> = {
  en: {
    nav: "Ratings", navBlurb: "Your Booking.com and Google scores, shown to guests",
    title: "Your review scores",
    subtitle: "Copy your score from your Booking.com and Google pages. Your booking page shows it under the search bar, linked to the source so a guest can check it — the reassurance they would otherwise leave your page to find.",
    sources: { booking: "Booking.com", google: "Google" },
    scale: { booking: "out of 10", google: "out of 5" },
    score: "Score", count: "Number of reviews", url: "Link to your page",
    urlHint: { booking: "Your hotel's page on booking.com", google: "Your Google Maps link (Share → Copy link)" },
    save: "Save", saving: "Saving…", remove: "Remove",
    confirmed: (d) => `Last confirmed ${d} — save again after you check it, at least once a year`,
    notSet: "Not shown yet.",
    hidden: { low: "Not shown: below the level that reassures a guest (7.0 on Booking.com, 3.5 on Google).", stale: "Not shown: not confirmed for over a year. Check the number and save it again." },
    errors: { score: (s) => `Enter the score ${s}, e.g. 8.9.`, url: "The link must be an https link to that site's own page." },
    saved: (s) => `${s} score saved.`, removed: (s) => `${s} score removed.`,
    why: "We do not ask your guests for reviews — guests who booked through a booking site are covered by that site's rules. This only quotes what is already public.",
  },
  bg: {
    nav: "Оценки", navBlurb: "Оценките Ви в Booking.com и Google, показани на гостите",
    title: "Вашите оценки от отзиви",
    subtitle: "Препишете оценката си от страниците си в Booking.com и Google. Страницата за директни резервации я показва под търсачката, с линк към източника, за да може гостът да я провери — увереността, за която иначе би напуснал страницата Ви.",
    sources: { booking: "Booking.com", google: "Google" },
    scale: { booking: "от 10", google: "от 5" },
    score: "Оценка", count: "Брой отзиви", url: "Линк към страницата Ви",
    urlHint: { booking: "Страницата на хотела в booking.com", google: "Линкът Ви в Google Maps (Сподели → Копирай линка)" },
    save: "Запази", saving: "Запазваме…", remove: "Премахни",
    confirmed: (d) => `Последно потвърдена на ${d} — запазете отново, след като я проверите, поне веднъж годишно`,
    notSet: "Още не се показва.",
    hidden: { low: "Не се показва: под нивото, което успокоява госта (7,0 в Booking.com, 3,5 в Google).", stale: "Не се показва: не е потвърждавана над година. Проверете числото и я запазете отново." },
    errors: { score: (s) => `Въведете оценката ${s}, напр. 8,9.`, url: "Линкът трябва да е https към собствената страница на този сайт." },
    saved: (s) => `Оценката от ${s} е запазена.`, removed: (s) => `Оценката от ${s} е премахната.`,
    why: "Не молим гостите Ви за отзиви — гостите, резервирали през сайт за резервации, са обвързани с правилата на този сайт. Тук само цитираме вече публичното.",
  },
};
