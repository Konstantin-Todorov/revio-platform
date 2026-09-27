import type { Translations } from "@revio/ui/i18n";
import { PULL_INTERVAL_MINUTES } from "@revio/core";

/**
 * RevioLink's Sync Center — the push/pull log, the open errors and the audit log.
 *
 * ⚠️ The RECORDS stay as they were written. A sync event's summary, an error's message and an audit
 * line are stored sentences carrying booking numbers and names, recorded in English at the moment
 * they happened. Translating them would mean matching the English, which this codebase does not do;
 * they are a log, and a log is kept as written. Everything around them — headings, columns,
 * statuses, buttons, the cadence sentence — is the reader's.
 *
 * `cadence` is core's `syncCadence`, worded again from the same facts; the drift test holds the
 * English to core's, word for word.
 */
export interface CmSyncStrings {
  title: string;
  subtitle: string;
  tiles: { critical: string; warnings: string; limitations: string };
  tabsLabel: string;
  tabs: { activity: string; errors: string; audit: string };
  recordsNote: string;
  logs: { title: string; subtitle: string; allChannels: string; filter: string; empty: string };
  cols: { direction: string; channel: string; summary: string; status: string; when: string };
  kinds: Record<string, string>;
  statuses: Record<string, string>;
  errors: {
    limitation: string;
    severity: Record<string, string>;
    recommended: string;
    fixInMapping: string;
    ignoreTitle: string;
    resolveTitle: string;
    ignore: string;
    resolve: string;
    real: string;
    limitations: string;
    none: string;
  };
  audit: {
    title: string;
    cols: { entity: string; field: string; old: string; new: string; source: string; result: string; when: string };
    results: Record<string, string>;
  };
  cadence: {
    ago: { justNow: string; minute: string; minutes: (n: number) => string; hour: string; hours: (n: number) => string; day: string; days: (n: number) => string };
    next: { anyMoment: string; inMinutes: (n: number) => string };
    never: (interval: number) => string;
    overdue: (interval: number, ago: string) => string;
    normal: (interval: number, ago: string, next: string) => string;
  };
}

export const sync: Translations<CmSyncStrings> = {
  en: {
    title: "Sync Center",
    subtitle: "Everything sent to your channels, every booking received, and a permanent record of who changed what",
    tiles: { critical: "Critical errors", warnings: "Warnings", limitations: "Channel limitations (not errors)" },
    tabsLabel: "Sync Center views",
    tabs: { activity: "Activity", errors: "Errors", audit: "Audit Log" },
    recordsNote: "",
    logs: {
      title: "Logs — pushes & pulls",
      subtitle: "Green = a channel accepted it · amber = it did not get there · red = it failed",
      allChannels: "All channels",
      filter: "Filter",
      empty: "No sync activity yet.",
    },
    cols: { direction: "Direction", channel: "Channel", summary: "Summary", status: "Status", when: "When" },
    kinds: { push: "push", pull: "pull" },
    statuses: { success: "success", pending: "pending", failed: "failed", warning: "warning", noop: "noop", skipped: "skipped" },
    errors: {
      limitation: "limitation",
      severity: { critical: "critical", warning: "warning", info: "info" },
      recommended: "Recommended:",
      fixInMapping: "Fix in Mapping →",
      ignoreTitle: "Ignore — this channel simply doesn't support the restriction",
      resolveTitle: "Mark resolved",
      ignore: "Ignore",
      resolve: "Resolve",
      real: "Real errors — something broke",
      limitations: "Channel limitations — known in advance, not failures",
      none: "No open errors. Check the Activity log to confirm your changes are reaching a channel — nothing failing is not the same as something arriving.",
    },
    audit: {
      title: "Permanent record of every change",
      cols: { entity: "Entity", field: "Field", old: "Old", new: "New", source: "Source", result: "Result", when: "When" },
      results: { success: "success", failed: "failed" },
    },
    cadence: {
      ago: {
        justNow: "just now", minute: "1 minute ago", minutes: (n) => `${n} minutes ago`,
        hour: "1 hour ago", hours: (n) => `${n} hours ago`, day: "1 day ago", days: (n) => `${n} days ago`,
      },
      next: { anyMoment: "any moment now", inMinutes: (n) => `in about ${n} minute${n === 1 ? "" : "s"}` },
      never: (i) => `Bookings are collected automatically about every ${i} minutes. This channel has not collected any yet.`,
      overdue: (i, a) => `Bookings should arrive within ${i} minutes and the last collection was ${a}. That is longer than it should be — check this channel's connection.`,
      normal: (i, a, n) => `Bookings arrive on their own, within about ${i} minutes. Last collected ${a}, next ${n}. Prices, availability and restrictions are sent the moment you save them.`,
    },
  },
  bg: {
    title: "Синхронизация",
    subtitle: "Всичко изпратено към каналите, всяка получена резервация и постоянен запис кой какво е променил",
    tiles: { critical: "Критични грешки", warnings: "Предупреждения", limitations: "Ограничения на каналите (не са грешки)" },
    tabsLabel: "Изгледи на синхронизацията",
    tabs: { activity: "Активност", errors: "Грешки", audit: "Журнал на промените" },
    recordsNote: "Записите се пазят така, както са направени в момента на събитието — на английски.",
    logs: {
      title: "Журнал — изпращания и изтегляния",
      subtitle: "Зелено = каналът го прие · жълто = не стигна · червено = неуспешно",
      allChannels: "Всички канали",
      filter: "Филтрирай",
      empty: "Все още няма активност по синхронизацията.",
    },
    cols: { direction: "Посока", channel: "Канал", summary: "Описание", status: "Статус", when: "Кога" },
    kinds: { push: "изпращане", pull: "изтегляне" },
    statuses: { success: "успешно", pending: "чака", failed: "неуспешно", warning: "внимание", noop: "без промяна", skipped: "пропуснато" },
    errors: {
      limitation: "ограничение",
      severity: { critical: "критично", warning: "предупреждение", info: "информация" },
      recommended: "Препоръка:",
      fixInMapping: "Поправете в „Съответствия“ →",
      ignoreTitle: "Пренебрегни — този канал просто не поддържа ограничението",
      resolveTitle: "Отбележи като решено",
      ignore: "Пренебрегни",
      resolve: "Затвори",
      real: "Реални грешки — нещо се е счупило",
      limitations: "Ограничения на каналите — известни предварително, не са грешки",
      none: "Няма отворени грешки. Проверете журнала „Активност“, за да се уверите, че промените стигат до канал — липсата на грешки не означава, че нещо пристига.",
    },
    audit: {
      title: "Постоянен запис на всяка промяна",
      cols: { entity: "Обект", field: "Поле", old: "Старо", new: "Ново", source: "Източник", result: "Резултат", when: "Кога" },
      results: { success: "успешно", failed: "неуспешно" },
    },
    cadence: {
      ago: {
        justNow: "току-що", minute: "преди 1 минута", minutes: (n) => `преди ${n} минути`,
        hour: "преди 1 час", hours: (n) => `преди ${n} часа`, day: "преди 1 ден", days: (n) => `преди ${n} дни`,
      },
      next: { anyMoment: "всеки момент", inMinutes: (n) => `след около ${n} ${n === 1 ? "минута" : "минути"}` },
      never: (i) => `Резервациите се изтеглят автоматично приблизително на всеки ${i} минути. Този канал още не е изтеглил нито една.`,
      overdue: (i, a) => `Резервациите трябва да пристигат до ${i} минути, а последното изтегляне беше ${a}. Това е по-дълго от нормалното — проверете връзката на канала.`,
      normal: (i, a, n) => `Резервациите пристигат сами, до около ${i} минути. Последно изтегляне ${a}, следващо ${n}. Цените, наличността и ограниченията се изпращат в момента, в който ги запазите.`,
    },
  },
};

/** Core's `syncCadence`, worded for the reader from the same facts — core's rules, these words. */
export function sayCadence(s: CmSyncStrings, lastSyncAt: Date | null, now: Date, interval = PULL_INTERVAL_MINUTES): { sentence: string; overdue: boolean } {
  const c = s.cadence;
  if (!lastSyncAt) return { sentence: c.never(interval), overdue: false };
  const elapsedMs = now.getTime() - lastSyncAt.getTime();
  const mins = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const ago = mins < 1 ? c.ago.justNow
    : mins === 1 ? c.ago.minute
    : mins < 60 ? c.ago.minutes(mins)
    : hours === 1 ? c.ago.hour
    : hours < 24 ? c.ago.hours(hours)
    : days === 1 ? c.ago.day : c.ago.days(days);
  const dueInMs = interval * 60_000 - elapsedMs;
  const overdue = elapsedMs > interval * 2 * 60_000;
  if (overdue) return { sentence: c.overdue(interval, ago), overdue };
  const next = dueInMs <= 30_000 ? c.next.anyMoment : c.next.inMinutes(Math.max(1, Math.round(dueInMs / 60_000)));
  return { sentence: c.normal(interval, ago, next), overdue };
}
