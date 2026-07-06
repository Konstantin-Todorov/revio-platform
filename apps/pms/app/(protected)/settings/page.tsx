import Link from "next/link";
import { BedDouble, Wine, Moon, Radio, Users, Building2 } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getPmsSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<string, string> = { mock: "Demo (mock)", channex_sandbox: "Channex sandbox", channex_prod: "Channex" };

export default async function SettingsPage() {
  const { property, channels, counts } = await getPmsSettings();

  const links = [
    { href: "/rooms", icon: BedDouble, label: "Rooms & Units", sub: `${counts.units} rooms · ${counts.roomTypes} types` },
    { href: "/minibar/catalog", icon: Wine, label: "Minibar / POS catalog", sub: `${counts.posItems} items` },
    { href: "/closeday", icon: Moon, label: "Close Day (night audit)", sub: "roll the business date" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle={`${property.name} · property profile, operations & connections`} />

      {/* Property profile */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-900"><Building2 className="h-4 w-4 text-accent-600" /> Property</div>
        <div className="grid gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2">
          <div>Name: <span className="font-semibold text-ink-900">{property.name}</span></div>
          <div>Time zone: <span className="font-semibold text-ink-900">{property.timezone}</span></div>
          <div>Currency: <span className="font-semibold text-ink-900">{property.baseCurrency}</span></div>
          <div>Check-in / out: <span className="font-semibold text-ink-900">{property.checkInTime} / {property.checkOutTime}</span></div>
          {property.businessDate && <div>Business date: <span className="font-semibold text-ink-900">{new Date(property.businessDate).toISOString().slice(0, 10)}</span></div>}
        </div>
        <p className="mt-3 text-[11.5px] text-ink-400">Property profile, rooms and rates are shared across the platform — edit them in RevioLink / RevioCRS.</p>
      </Card>

      {/* Operations quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 shadow-card transition-colors hover:bg-surface-muted">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">{l.label}</div>
                <div className="text-[11.5px] text-ink-500">{l.sub}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Staff */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink-900"><Users className="h-4 w-4 text-accent-600" /> Staff & permissions</div>
        <p className="text-[12.5px] text-ink-600">Staff accounts and roles are managed once in <span className="font-semibold text-ink-900">RevioLink → Settings</span> — one account works across every product this hotel has.</p>
      </Card>

      {/* Connections (read-only) */}
      <Card>
        <CardHeader title="Connections" action={<span className="text-[11.5px] text-ink-400">managed in RevioLink</span>} />
        {channels.length === 0 ? (
          <div className="px-4 py-5 text-center text-[12.5px] text-ink-400">No channels on this property. Distribution is configured in RevioLink.</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Radio className="h-4 w-4 text-ink-400" />
                  <span className="text-[13px] font-semibold text-ink-900">{c.name}</span>
                  <span className="text-[11px] text-ink-400">{MODE_LABEL[c.connectivityMode] ?? c.connectivityMode}</span>
                </div>
                <StatusPill tone={(c.status === "connected" ? "success" : "neutral") as Tone}>{c.status}</StatusPill>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">
          A room going out-of-order here comes off sale on these channels automatically (shared availability core).
        </p>
      </Card>
    </div>
  );
}
