import type { Translations } from "./i18n";

/** The stay picker (`stay-range-field.tsx`). Strings only — it is a client component. */
export interface StayRangeStrings {
  nightOne: string;
  nightMany: string;
  chooseDeparture: string;
  chooseDates: string;
  dialog: string;
  clickArrival: string;
  clear: string;
  done: string;
  label: string;
  prev: string;
  next: string;
}

export const stayRangeStrings: Translations<StayRangeStrings> = {
  en: {
    nightOne: "{n} night", nightMany: "{n} nights", chooseDeparture: "choose a departure", chooseDates: "Choose your dates",
    dialog: "Choose arrival and departure", clickArrival: "Click arrival, then departure", clear: "Clear", done: "Done",
    label: "Stay dates", prev: "Previous month", next: "Next month",
  },
  bg: {
    nightOne: "{n} нощувка", nightMany: "{n} нощувки", chooseDeparture: "изберете напускане", chooseDates: "Изберете дати",
    dialog: "Изберете пристигане и напускане", clickArrival: "Изберете пристигане, после напускане", clear: "Изчисти", done: "Готово",
    label: "Дати на престоя", prev: "Предишен месец", next: "Следващ месец",
  },
};
