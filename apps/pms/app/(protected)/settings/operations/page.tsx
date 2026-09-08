import Link from "next/link";
import { BedDouble, Wine, Moon } from "lucide-react";
import { getPmsSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/** The three things this product configures for itself, each on its own screen. */
export default async function OperationsSettingsPage() {
  const { counts } = await getPmsSettings();

  const links = [
    { href: "/rooms", icon: BedDouble, label: "Rooms & Units", sub: `${counts.units} rooms · ${counts.roomTypes} types` },
    { href: "/minibar/catalog", icon: Wine, label: "Minibar / POS catalog", sub: `${counts.posItems} items` },
    { href: "/closeday", icon: Moon, label: "Close Day (night audit)", sub: "roll the business date" },
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
