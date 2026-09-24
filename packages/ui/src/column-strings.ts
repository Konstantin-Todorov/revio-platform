import type { Translations } from "./i18n";

/** The "Columns" menu over a table (`column-visibility.tsx`). Strings only — it is a client component. */
export interface ColumnStrings {
  columns: string;
  /** "{n} hidden" */
  hidden: string;
  show: string;
  always: string;
  showAll: string;
}

export const columnStrings: Translations<ColumnStrings> = {
  en: { columns: "Columns", hidden: "{n} hidden", show: "Show columns", always: "always", showAll: "Show all columns" },
  bg: { columns: "Колони", hidden: "{n} скрити", show: "Показани колони", always: "винаги", showAll: "Покажи всички колони" },
};
