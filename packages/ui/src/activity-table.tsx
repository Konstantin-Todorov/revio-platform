import { History, Info, User } from "lucide-react";
import { LOCALE_LABELS, translate, type Locale } from "./i18n";
import { activityStrings } from "./activity-strings";

export interface ActivityRowView {
  id: string;
  at: Date;
  /** The person, or null for an entry that names nobody (pre-2026-09-01, or a cron job). */
  actor: string | null;
  entity: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string;
}

export interface ActivityView {
  rows: ActivityRowView[];
  hiddenAutomatic: number;
  more: boolean;
  from: string;
  to: string;
  actors: { id: string; name: string }[];
  unattributed: number;
}

/**
 * The change log, shared by RevioPMS and RevioCRS.
 *
 * One table in two products because the AuditEntry rows are ONE stream per property — a rate edited
 * in the CRS and a folio voided in the PMS are the same hotel's history, and a manager asking "who
 * changed this" should not have to know which product wrote the row. Each app supplies its own data
 * (its own session, its own property scope); only the rendering is shared.
 *
 * Presentational and server-rendered: no state, no client bundle, and the filter is a plain GET form
 * so a filtered view is a URL somebody can send to a colleague.
 */
export function ActivityTable({
  view, showAutomaticHref, labels, locale = "en", timeZone,
}: {
  view: ActivityView;
  /** Link that re-runs the current query with automatic entries included. */
  showAutomaticHref: string;
  labels: { automaticNote: string };
  locale?: Locale;
  /**
   * The property's zone. Without it the time is the SERVER's clock — UTC in production, three
   * hours behind a Bulgarian hotel, on the one screen that exists to say when something happened.
   */
  timeZone?: string;
}) {
  const t = translate(activityStrings, locale);
  const when = (d: Date) =>
    d.toLocaleString(LOCALE_LABELS[locale].intl, {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}),
    });

  return (
    <>
      {view.hiddenAutomatic > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-surface-border bg-surface-muted px-4 py-2.5 text-[12.5px] text-ink-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
          <p>
            <strong className="font-semibold">{view.hiddenAutomatic}</strong>{" "}
            {view.hiddenAutomatic === 1 ? t.hiddenOne : t.hiddenMany} {labels.automaticNote}{" "}
            <a href={showAutomaticHref} className="font-semibold text-accent-600 hover:underline">{t.showAnyway}</a>.
          </p>
        </div>
      )}

      {view.unattributed > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-2.5 text-[12.5px] text-warning-700">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="font-semibold">{view.unattributed}</strong> {t.unattributed}
          </p>
        </div>
      )}

      {view.rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-400">
          {t.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {[t.cols.when, t.cols.who, t.cols.what, t.cols.change].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/60 align-top last:border-0 hover:bg-surface-muted">
                  <td className="tnum whitespace-nowrap px-3 py-2 text-ink-500">{when(r.at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink-800">
                    {r.actor ?? <span className="font-normal text-ink-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink-900">{r.entity}</span>
                    {r.field && <span className="ml-1.5 text-ink-500">{r.field}</span>}
                    {r.source !== "manual" && (
                      <span className="ml-1.5 rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-400">
                        {r.source}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-600">
                    {r.oldValue && <span className="text-ink-400 line-through">{r.oldValue}</span>}
                    {r.oldValue && r.newValue && <span className="mx-1.5 text-ink-300">→</span>}
                    {r.newValue}
                    {!r.oldValue && !r.newValue && <span className="text-ink-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
        <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {view.more
          ? t.more
          : t.all}
      </p>
    </>
  );
}

/** The date / who / automatic filter, as a plain GET form. */
export function ActivityFilters({
  view, currentActor, includeAutomatic, locale = "en",
}: { view: ActivityView; currentActor?: string; includeAutomatic: boolean; locale?: Locale }) {
  const t = translate(activityStrings, locale);
  const input =
    "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none transition-colors focus:border-brand-600";
  return (
    <form method="GET" className="mb-4 flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{t.from}</span>
        <input type="date" name="from" defaultValue={view.from} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{t.to}</span>
        <input type="date" name="to" defaultValue={view.to} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{t.who}</span>
        <select name="actor" defaultValue={currentActor ?? ""} className={input}>
          <option value="">{t.anyone}</option>
          {view.actors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </label>
      <label className="flex h-9 items-center gap-2 text-[12.5px] text-ink-700">
        <input type="checkbox" name="auto" value="1" defaultChecked={includeAutomatic} className="h-4 w-4 rounded border-surface-border" />
        {t.includeAutomatic}
      </label>
      <button type="submit" className="h-9 rounded-md bg-brand-700 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-800">
        {t.show}
      </button>
    </form>
  );
}
