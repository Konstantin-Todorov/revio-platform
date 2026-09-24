import { ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { getConfiguration } from "@/lib/config";
import { saveDepositType, deleteDepositType } from "@/lib/actions-config";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { inputCls } from "@/components/config/ui";

export const dynamic = "force-dynamic";

/** Configuration → Deposits: each deposit type, and when the money it holds becomes revenue. */
export default async function ConfigDepositsPage() {
  const { depositTypes } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  return (
    <Card>
      <CardHeader title={t.deposits.title} subtitle={t.deposits.subtitle} />
      <div className="divide-y divide-surface-border/60 border-t border-surface-border/60">
        {depositTypes.map((dt) => (
          <form key={dt.id} action={saveDepositType} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <input type="hidden" name="id" value={dt.id} />
            <input name="name" defaultValue={dt.name} aria-label={t.deposits.title} className={`${inputCls} w-36`} />
            <select name="behaviour" defaultValue={dt.behaviour} className={`${inputCls} w-28`}>
              <option value="held">{t.deposits.held}</option>
              <option value="applied">{t.deposits.applied}</option>
            </select>
            <select name="vatTiming" defaultValue={dt.vatTiming} className={`${inputCls} w-36`} title={t.deposits.vatWhen}>
              <option value="use">{t.deposits.vatAtUse}</option>
              <option value="capture">{t.deposits.vatAtCapture}</option>
            </select>
            <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600"><input type="checkbox" name="active" defaultChecked={dt.active} className="h-4 w-4 rounded border-surface-border text-accent-600" /> {t.deposits.active}</label>
            <span className="ml-auto flex items-center gap-1">
              <button className="rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted">{t.deposits.save}</button>
              <button formAction={deleteDepositType} className="rounded-md px-2 py-1.5 text-[12px] font-semibold text-ink-400 hover:text-danger-600">{t.deposits.delete}</button>
            </span>
          </form>
        ))}
      </div>
      <form action={saveDepositType} className="flex flex-wrap items-end gap-2 rounded-b-xl border-t border-surface-border bg-surface-muted px-4 py-3">
        <input name="name" required placeholder={t.deposits.newPlaceholder} className={`${inputCls} w-40`} />
        <select name="behaviour" defaultValue="held" className={`${inputCls} w-28`}><option value="held">{t.deposits.held}</option><option value="applied">{t.deposits.applied}</option></select>
        <select name="vatTiming" defaultValue="use" className={`${inputCls} w-36`}><option value="use">{t.deposits.vatAtUse}</option><option value="capture">{t.deposits.vatAtCapture}</option></select>
        <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white hover:bg-accent-500"><ShieldCheck className="h-3.5 w-3.5" /> {t.deposits.add}</button>
      </form>
    </Card>
  );
}
