import Link from "next/link";
import { getProperty } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";


export default async function SettingsPropertyPage() {
  const property = await getProperty();

  return (
    <>
      <Card>
        <CardHeader title="Property & platform" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px] lg:grid-cols-4">
          <dt className="text-ink-400">Property</dt><dd className="font-semibold text-ink-900">{property.name}</dd>
          <dt className="text-ink-400">Time zone</dt><dd className="text-ink-700">{property.timezone}</dd>
          <dt className="text-ink-400">Currency</dt><dd className="text-ink-700">{property.baseCurrency}</dd>
          <dt className="text-ink-400">Check-in / out</dt><dd className="tnum text-ink-700">{property.checkInTime} / {property.checkOutTime}</dd>
        </dl>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Profile & currency are edited in RevioLink → Settings. Metric defaults (no-shows, gross/net, pickup window,
          alert thresholds, hold TTL) live under <Link href="/rates" className="font-semibold text-brand-700 hover:underline">Rates → Property defaults</Link>.
          Housekeeping, folios and the night audit live in RevioPMS.
        </p>
      </Card>
    </>
  );
}
