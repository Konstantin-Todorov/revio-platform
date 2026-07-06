import Link from "next/link";
import { Search, Building2, Hotel, User } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { operatorSearch } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const { tenants, properties, users } = await operatorSearch(term);
  const total = tenants.length + properties.length + users.length;

  const section = (title: string, icon: typeof Building2, rows: { key: string; label: string; sub?: string }[]) => {
    if (rows.length === 0) return null;
    const Icon = icon;
    return (
      <Card>
        <CardHeader title={title} />
        <ul className="divide-y divide-surface-border">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href="/clients" className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                <Icon className="h-4 w-4 text-ink-400" />
                <span className="text-[13.5px] font-semibold text-ink-900">{r.label}</span>
                {r.sub && <span className="text-[11.5px] text-ink-500">{r.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="Search" subtitle={term ? `Results for “${term}”` : "Search clients, properties and owners"} />

      {!term ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-2 h-6 w-6 text-ink-300" />
          <p className="text-[13px] text-ink-500">Type in the search bar above to find a client, property, or owner.</p>
        </Card>
      ) : total === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">Nothing found for “{term}”.</Card>
      ) : (
        <div className="space-y-4">
          {section("Clients", Building2, tenants.map((t) => ({ key: t.id, label: t.name, sub: `${t.plan} · ${t.status}` })))}
          {section("Properties", Hotel, properties.map((p) => ({ key: p.id, label: p.name, sub: p.tenant.name })))}
          {section("Owners & staff", User, users.map((u) => ({ key: u.id, label: u.name, sub: `${u.email} · ${u.tenant.name}` })))}
        </div>
      )}
    </div>
  );
}
