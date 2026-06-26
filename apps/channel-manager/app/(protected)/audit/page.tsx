import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const property = await getProperty();
  const entries = await prisma.auditEntry.findMany({
    where: { propertyId: property.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Permanent record of every change — who, when, what" />
      <Card>
        <CardHeader title="Recent changes" />
        <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
              {["Entity", "Field", "Old", "New", "Source", "Result", "When"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-surface-border/60 transition-colors last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-semibold text-ink-900">{e.entity}</td>
                <td className="px-4 py-3 text-ink-500">{e.field ?? "—"}</td>
                <td className="px-4 py-3 text-ink-400">{e.oldValue ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-ink-700">{e.newValue ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-500">{e.source}</span></td>
                <td className="px-4 py-3">{e.syncResult ? <StatusPill tone={e.syncResult === "success" ? "success" : "danger"}>{e.syncResult}</StatusPill> : "—"}</td>
                <td className="px-4 py-3 text-[12px] text-ink-400">{relativeTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
