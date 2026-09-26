import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";
import Link from "next/link";
import { getProperty } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";


export default async function SettingsPropertyPage() {
  const property = await getProperty();
  const p = (await i18n()).t(settingsDict).property;

  return (
    <>
      <Card>
        <CardHeader title={p.title} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px] lg:grid-cols-4">
          <dt className="text-ink-400">{p.property}</dt><dd className="font-semibold text-ink-900">{property.name}</dd>
          <dt className="text-ink-400">{p.timezone}</dt><dd className="text-ink-700">{property.timezone}</dd>
          <dt className="text-ink-400">{p.currency}</dt><dd className="text-ink-700">{property.baseCurrency}</dd>
          <dt className="text-ink-400">{p.checkInOut}</dt><dd className="tnum text-ink-700">{property.checkInTime} / {property.checkOutTime}</dd>
        </dl>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          {p.noteLead}<Link href="/settings/policies" className="font-semibold text-brand-700 hover:underline">{p.noteLink}</Link>{p.noteTail}
        </p>
      </Card>
    </>
  );
}
