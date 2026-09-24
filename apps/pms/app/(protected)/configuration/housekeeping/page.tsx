import { getConfiguration } from "@/lib/config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { ConfigSectionForm } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/** Configuration → Housekeeping: inspection before a room is sellable, and automatic assignment. */
export default async function ConfigHousekeepingPage() {
  const { defaults: d } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  return (
    <ConfigSectionForm section="housekeeping" title={t.housekeeping.title} subtitle={t.housekeeping.subtitle} save={t.save}>
      <div className="divide-y divide-surface-border/60">
        <label className="flex cursor-pointer items-start gap-2.5 p-4">
          <input type="checkbox" name="inspectionGate" defaultChecked={d?.inspectionGate ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
          <span className="text-[12.5px] text-ink-700">
            <span className="font-semibold text-ink-900">{t.housekeeping.inspectionLead}</span> {t.housekeeping.inspectionBefore} <em>{t.housekeeping.pendingInspection}</em> {t.housekeeping.inspectionAfter}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 p-4">
          <input type="checkbox" name="autoAssignEnabled" defaultChecked={d?.autoAssignEnabled ?? false} className="mt-0.5 h-4 w-4 rounded border-surface-border text-accent-600 focus:ring-accent-600" />
          <span className="text-[12.5px] text-ink-700">
            <span className="font-semibold text-ink-900">{t.housekeeping.autoAssignLead}</span> {t.housekeeping.autoAssignBody}
          </span>
        </label>
      </div>
    </ConfigSectionForm>
  );
}
