import Link from "next/link";
import { Link2 } from "lucide-react";
import { getMapping } from "@/lib/data";
import { fixMappings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { MappingEditDialog } from "@/components/mapping/MappingEditDialog";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = { complete: "success", incomplete: "warning" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const sp = await searchParams;
  const { channels, channel, roomTypeMappings, ratePlanMappings } = await getMapping(sp.ch);

  if (!channel) {
    return (
      <div>
        <PageHeader title="Mapping" subtitle="Link your room types and rate plans to each channel's own IDs — self-service" />
        <EmptyState
          icon={<Link2 className="h-7 w-7" />}
          title="No channels connected yet"
          body="Mapping links your room types and rate plans to each channel's own IDs. Connect a channel first, then map them here."
          actionLabel="Connect a channel"
          actionHref="/channels"
        />
      </div>
    );
  }

  const incomplete =
    roomTypeMappings.filter((m) => m.status !== "complete").length +
    ratePlanMappings.filter((m) => m.status !== "complete").length;

  return (
    <div>
      <PageHeader title="Mapping" subtitle="Two streams: room types control inventory & open/close; rate plans control rates & restrictions" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/mapping?ch=${c.code}`}
              className={`rounded-md border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                c.id === channel.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-500 hover:bg-surface-muted"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        {incomplete > 0 ? (
          <form action={fixMappings}>
            <input type="hidden" name="channelId" value={channel.id} />
            <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              Auto-fix {incomplete} unmapped
            </button>
          </form>
        ) : (
          <StatusPill tone="success">All mapped</StatusPill>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Room Types stream — inventory + open/close */}
        <Card>
          <CardHeader title={`Room Types · ${channel.name}`} action={<span className="text-[11px] text-ink-400">inventory & open/close</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {["Room Type", "External Room ID", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {roomTypeMappings.map((m) => (
                  <tr key={m.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{m.roomType.name}</td>
                    <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRoomId ?? <span className="text-danger-500">—</span>}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <MappingEditDialog kind="room" id={m.id} label={m.roomType.name} externalId={m.externalRoomId} channelName={channel.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Rate Plans stream — rates + restrictions */}
        <Card>
          <CardHeader title={`Rate Plans · ${channel.name}`} action={<span className="text-[11px] text-ink-400">rates & restrictions</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {["Rate Plan", "External Rate ID", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {ratePlanMappings.map((m) => (
                  <tr key={m.id} className="group border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{m.ratePlan.name}</td>
                    <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRateId ?? <span className="text-danger-500">—</span>}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <MappingEditDialog kind="rate" id={m.id} label={m.ratePlan.name} externalId={m.externalRateId} channelName={channel.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
