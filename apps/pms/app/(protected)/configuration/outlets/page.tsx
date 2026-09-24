import Link from "next/link";
import { Sparkles, Wine } from "lucide-react";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";
import { getConfiguration } from "@/lib/config";
import { POS_OUTLETS } from "@/lib/roles";
import { i18n } from "@/lib/i18n/server";
import { configuration } from "@/lib/i18n/configuration";
import { extras } from "@/lib/i18n/extras";

export const dynamic = "force-dynamic";

/** Configuration → Outlets: where charges come from, with how many items each one sells. */
export default async function ConfigOutletsPage() {
  const { outletCounts } = await getConfiguration();
  const { t: tr } = await i18n();
  const t = tr(configuration);
  const outletLabel = tr(extras).outlets;

  return (
    <Card>
      <CardHeader title={t.outlets.title} subtitle={t.outlets.subtitle} action={<Link href="/minibar/catalog" className="text-[12px] font-semibold text-accent-600 hover:underline">{t.outlets.manage}</Link>} />
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {POS_OUTLETS.map((o) => (
          <Link key={o} href="/minibar/catalog" className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 hover:border-ink-300">
            {o === "spa" ? <Sparkles className="h-3 w-3 text-accent-500" /> : <Wine className="h-3 w-3 text-accent-500" />}
            {outletLabel[o] ?? o}
            <StatusPill tone="neutral">{outletCounts.get(o) ?? 0}</StatusPill>
          </Link>
        ))}
      </div>
    </Card>
  );
}
