import type { Translations } from "@revio/ui/i18n";

/** Words several RevioLink screens share — the confirm-then-delete dialog. */
export interface CmCommonStrings {
  deleteDialog: {
    aria: (label: string) => string;
    title: (label: string) => string;
    /** The sentence around the bold name: [before, after]. */
    removes: [string, string];
    cancel: string;
    delete: string;
  };
}

export const common: Translations<CmCommonStrings> = {
  en: {
    deleteDialog: {
      aria: (l) => `Delete ${l}`,
      title: (l) => `Delete ${l}?`,
      removes: ["This removes ", " and its prices, calendar cells and channel mappings."],
      cancel: "Cancel",
      delete: "Delete",
    },
  },
  bg: {
    deleteDialog: {
      aria: (l) => `Изтрий ${l}`,
      title: (l) => `Изтриване на ${l}?`,
      removes: ["Това премахва ", " заедно с цените, клетките в календара и връзките с каналите."],
      cancel: "Отказ",
      delete: "Изтрий",
    },
  },
};
