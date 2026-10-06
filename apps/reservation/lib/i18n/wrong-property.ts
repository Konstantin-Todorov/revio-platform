import type { Translations } from "@revio/ui/i18n";

/** "This booking / guest is at your other hotel" — see `@revio/ui/wrong-property`. */
export interface WrongPropertyStrings {
  title: (name: string, property: string) => string;
  thatRecord: string;
  things: { booking: string; guest: string };
  body: (thing: string) => string;
  switchTo: (property: string) => string;
  stay: string;
}

export const wrongProperty: Translations<WrongPropertyStrings> = {
  en: {
    title: (n, p) => `${n} is at ${p}`,
    thatRecord: "That record",
    things: { booking: "this booking", guest: "this guest's profile" },
    body: (thing) => `You are working in a different hotel right now, so ${thing} cannot be opened here. Switching takes you straight to it — everything else moves with you.`,
    switchTo: (p) => `Switch to ${p}`,
    stay: "Stay here",
  },
  bg: {
    title: (n, p) => `${n} е в ${p}`,
    thatRecord: "Този запис",
    things: { booking: "резервацията", guest: "профилът на госта" },
    body: (thing) => `В момента работите в друг хотел, затова ${thing} не може да се отвори тук. Превключването Ви отвежда директно там — всичко останало се премества с Вас.`,
    switchTo: (p) => `Превключи към ${p}`,
    stay: "Остани тук",
  },
};
