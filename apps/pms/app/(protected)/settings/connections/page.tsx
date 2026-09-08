import { Radio } from "lucide-react";
import { connectivityModeLabel } from "@revio/core";
import { Card, CardHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getPmsSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/** What this property sells on. Read-only: distribution is RevioLink's job. */
export default async function ConnectionsSettingsPage() {
  const { channels } = await getPmsSettings();

  return (
    <Card>
      <CardHeader
        title="Connections"
        action={<span className="text-[11.5px] text-ink-400">managed in RevioLink</span>}
      />
      {channels.length === 0 ? (
        <div className="px-4 py-5 text-center text-[12.5px] text-ink-400">
          No channels on this property. Distribution is configured in RevioLink.
        </div>
      ) : (
        <ul className="divide-y divide-surface-border">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Radio className="h-4 w-4 text-ink-400" />
                <span className="text-[13px] font-semibold text-ink-900">{c.name}</span>
                <span className="text-[11px] text-ink-400">{connectivityModeLabel(c.connectivityMode)}</span>
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
  );
}
