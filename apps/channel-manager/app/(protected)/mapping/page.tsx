import Link from "next/link";
import { Link2 } from "lucide-react";
import { getMapping } from "@/lib/data";
import { fixMappings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  complete: "success", incomplete: "warning", missing_room: "danger", missing_rate: "danger",
  channel_error: "danger", disabled: "neutral", pending_confirmation: "info",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const sp = await searchParams;
  const { channels, channel, mappings } = await getMapping(sp.ch);

  if (!channel) {
    return (
      <div>
        <PageHeader title="Mapping" subtitle="Link your products to each channel's own IDs — self-service" />
        <EmptyState
          icon={<Link2 className="h-7 w-7" />}
          title="No channels connected yet"
          body="Mapping links your room types and rate plans to each channel's own IDs. Connect a channel first, then map its products here."
          actionLabel="Connect a channel"
          actionHref="/channels"
        />
      </div>
    );
  }
  const incomplete = mappings.filter((m) => m.status !== "complete").length;

  return (
    <div>
      <PageHeader title="Mapping" subtitle="Link your products to each channel's own IDs — self-service" />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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

      <Card>
        <CardHeader
          title={`${channel.name} — product mapping`}
          action={
            incomplete > 0 ? (
              <form action={fixMappings}>
                <input type="hidden" name="channelId" value={channel.id} />
                <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
                  Auto-fix {incomplete} incomplete
                </button>
              </form>
            ) : (
              <StatusPill tone="success">All mapped</StatusPill>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Room Type", "Rate Plan", "External Room ID", "External Rate ID", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{m.roomType.name}</td>
                  <td className="px-4 py-2.5 text-ink-600">{m.ratePlan.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRoomId ?? <span className="text-danger-500">—</span>}</td>
                  <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRateId ?? <span className="text-danger-500">—</span>}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{m.status.replace(/_/g, " ")}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
