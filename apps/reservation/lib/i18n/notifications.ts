import type { Translations } from "@revio/ui/i18n";

/** What RevioCRS's bell says — the attention states and the events. Built on the server. */
export interface NotificationStrings {
  channelErrors: (n: number) => string;
  arrivals: (n: number) => string;
  departures: (n: number) => string;
  newBooking: (guest: string) => string;
  cancelled: (guest: string) => string;
  via: (channel: string) => string;
  resolved: (message: string) => string;
  noName: string;
}

export const notifications: Translations<NotificationStrings> = {
  en: {
    channelErrors: (n) => `${n} open channel error${n === 1 ? "" : "s"} — in RevioLink`,
    arrivals: (n) => `${n} arrival${n === 1 ? "" : "s"} today`,
    departures: (n) => `${n} departure${n === 1 ? "" : "s"} today`,
    newBooking: (g) => `New booking — ${g}`,
    cancelled: (g) => `Cancelled — ${g}`,
    via: (c) => `via ${c}`,
    resolved: (m) => `Resolved — ${m}`,
    noName: "no name given",
  },
  bg: {
    channelErrors: (n) => `${n} ${n === 1 ? "отворена грешка" : "отворени грешки"} в каналите — в RevioLink`,
    arrivals: (n) => `${n} ${n === 1 ? "пристигане" : "пристигания"} днес`,
    departures: (n) => `${n} ${n === 1 ? "напускане" : "напускания"} днес`,
    newBooking: (g) => `Нова резервация — ${g}`,
    cancelled: (g) => `Анулирана — ${g}`,
    via: (c) => `чрез ${c}`,
    resolved: (m) => `Решено — ${m}`,
    noName: "без име",
  },
};
