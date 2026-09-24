import type { Translations } from "./i18n";

/** The audit log's frame — the entries themselves are records and read as they were written. */
export interface ActivityStrings {
  /** "{n} automatic entries are hidden — " */
  hiddenOne: string;
  hiddenMany: string;
  showAnyway: string;
  /** "{n} of these name nobody…" */
  unattributed: string;
  empty: string;
  cols: { when: string; who: string; what: string; change: string };
  more: string;
  all: string;
  from: string;
  to: string;
  who: string;
  anyone: string;
  includeAutomatic: string;
  show: string;
}

export const activityStrings: Translations<ActivityStrings> = {
  en: {
    hiddenOne: "automatic entry is hidden —",
    hiddenMany: "automatic entries are hidden —",
    showAnyway: "Show them anyway",
    unattributed: "of these name nobody. Until 1 September 2026 this software recorded the change but not the person, so anything older says “—”. Entries from now on carry who made them.",
    empty: "Nothing changed in this window. Widen the dates, or include automatic entries.",
    cols: { when: "When", who: "Who", what: "What", change: "Change" },
    more: "There are more changes in this window than fit on one page. Narrow the dates to see the rest.",
    all: "Everything recorded in this window is shown.",
    from: "From",
    to: "To",
    who: "Who",
    anyone: "Anyone",
    includeAutomatic: "Include automatic",
    show: "Show",
  },
  bg: {
    hiddenOne: "автоматичен запис е скрит —",
    hiddenMany: "автоматични записа са скрити —",
    showAnyway: "Покажи ги все пак",
    unattributed: "от тях не посочват човек. До 1 септември 2026 г. системата записваше промяната, но не и кой я е направил, затова по-старите записи показват „—“. Всички нови записи посочват автора си.",
    empty: "В този период няма промени. Разширете датите или включете автоматичните записи.",
    cols: { when: "Кога", who: "Кой", what: "Какво", change: "Промяна" },
    more: "В този период има повече промени, отколкото се побират на една страница. Стеснете датите, за да видите останалите.",
    all: "Показано е всичко, записано в този период.",
    from: "От",
    to: "До",
    who: "Кой",
    anyone: "Всеки",
    includeAutomatic: "Включи автоматичните",
    show: "Покажи",
  },
};
