import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { ConfigSectionForm, inputCls, labelCls } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/**
 * Configuration → End of day (§3.4): the two timings that decide when an unclosed day starts
 * nagging and when the system ends it. Per-property because the business-day boundary already
 * varies: a property that audits at 03:00 and one that audits at midnight cannot share a deadline.
 */
export default async function ConfigEndOfDayPage() {
  const { defaults: d } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  return (
    <ConfigSectionForm section="endOfDay" title={t.endOfDay.title} subtitle={t.endOfDay.subtitle} save={t.save}>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t.endOfDay.remindAfter}</label>
            <input name="closeDeadlineMinutes" type="number" min="0" max="1439" defaultValue={d?.closeDeadlineMinutes ?? 30} className={`${inputCls} w-full`} />
            <p className="mt-1 text-[11px] text-ink-400">{t.endOfDay.remindHint}</p>
          </div>
          <div>
            <label className={labelCls}>{t.endOfDay.closeAfter}</label>
            <input name="closeReminderWindowHours" type="number" min="1" max="72" defaultValue={d?.closeReminderWindowHours ?? 22} className={`${inputCls} w-full`} />
            <p className="mt-1 text-[11px] text-ink-400">{t.endOfDay.closeHint}</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-surface-border p-3">
          <input type="checkbox" name="autoCloseEnabled" defaultChecked={d?.autoCloseEnabled ?? true} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
          <span className="text-[12.5px] text-ink-700">
            <span className="font-semibold text-ink-900">{t.endOfDay.autoCloseLead}</span> {t.endOfDay.autoCloseBody}
          </span>
        </label>
      </div>
    </ConfigSectionForm>
  );
}
