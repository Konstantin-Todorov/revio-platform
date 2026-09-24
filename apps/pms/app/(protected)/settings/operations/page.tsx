import Link from "next/link";
import { BedDouble, Wine, Moon } from "lucide-react";
import { getPmsSettings } from "@/lib/data";
import { i18n } from "@/lib/i18n/server";
import { settings } from "@/lib/i18n/settings";

export const dynamic = "force-dynamic";

/** The three things this product configures for itself, each on its own screen. */
export default async function OperationsSettingsPage() {
  const { counts } = await getPmsSettings();
  const { t: tr } = await i18n();
  const t = tr(settings).operations;

  const links = [
    { href: "/rooms", icon: BedDouble, label: t.rooms, sub: t.roomsSub(counts.units, counts.roomTypes) },
    { href: "/minibar/catalog", icon: Wine, label: t.catalog, sub: t.catalogSub(counts.posItems) },
    { href: "/closeday", icon: Moon, label: t.closeday, sub: t.closedaySub },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 shadow-card transition-colors hover:bg-surface-muted"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink-900">{l.label}</div>
              <div className="text-[11.5px] text-ink-500">{l.sub}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
