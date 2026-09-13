"use server";

import { forSystem } from "@revio/db";
import { isSearchable, type SearchHit } from "@revio/core";
import { getOperatorSession } from "./session";
import { OPERATOR_AREAS } from "@/components/shell/navigation";

const prisma = forSystem();

/**
 * What ⌘K finds in the Operator console.
 *
 * ## ⚠️ This is the one palette that crosses tenants, and that is the whole point
 *
 * The other three are scoped to one hotel's own data by session and by RLS underneath. This one is
 * the **operator perimeter**: it reads every hotel through `forSystem()`, which bypasses tenant RLS.
 * That is correct here and nowhere else, so the gate is `getOperatorSession()` and it returns an
 * empty list — never a partial one — when there is no operator identity.
 *
 * ## Demo tenants are included, and badged
 *
 * `lib/demo.ts` states the rule this follows: *money and portfolio metrics exclude demo; operations
 * and health include it* — and it names **search** as included. So Hotel Sofia Group is findable
 * here exactly like a paying client, with `context: "Demo"` on every row it owns. Hiding them would
 * make the console lie about what exists; showing them unmarked would make it lie about who pays.
 *
 * ## What an operator actually types
 *
 * A client's name, a property's name, an owner's email when a support mail arrives from an address
 * nobody recognises, and an **invoice number** when somebody asks what a bill was for. The last one
 * is the reason `invoice` is in the shared `HitKind` list.
 */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  if (!isSearchable(query)) return [];
  const session = await getOperatorSession();
  if (!session) return [];

  const term = query.trim();
  const take = 6;
  const like = { contains: term, mode: "insensitive" as const };

  const [tenants, properties, users, invoices] = await Promise.all([
    prisma.tenant.findMany({
      where: { OR: [{ name: like }, { slug: like }] },
      select: { id: true, name: true, slug: true, status: true, isDemo: true, plan: true },
      take,
    }),
    prisma.property.findMany({
      where: { name: like },
      select: { id: true, name: true, tenantId: true, tenant: { select: { name: true, isDemo: true } } },
      take,
    }),
    prisma.user.findMany({
      where: { OR: [{ name: like }, { email: like }] },
      select: { id: true, name: true, email: true, role: true, tenantId: true, tenant: { select: { name: true, isDemo: true } } },
      take,
    }),
    /* ⚠️ `Invoice` carries a `tenantId` and NO `tenant` relation — it lives in the operator's own
       admin space, deliberately not joined to the hotel's tables. So the client's name is resolved
       below from the tenants already fetched plus one lookup, rather than by a join Prisma would
       refuse. */
    prisma.invoice.findMany({
      where: { OR: [{ number: like }, { period: like }] },
      select: {
        id: true, number: true, period: true, status: true, amountMinor: true, currency: true,
        tenantId: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const invoiceTenants = invoices.length
    ? await prisma.tenant.findMany({
        where: { id: { in: [...new Set(invoices.map((i) => i.tenantId))] } },
        select: { id: true, name: true, isDemo: true },
      })
    : [];
  const tenantById = new Map(invoiceTenants.map((t) => [t.id, t]));

  /* ⚠️ The badge says "not a real hotel", NOT which client — which is the opposite of what `context`
     carries in the other three products. There it disambiguates two identically named rooms; here
     the client name goes in the subtitle (every row already belongs to exactly one), and the chip is
     spent on the one fact an operator must never miss while reading a figure. */
  const demo = (isDemo: boolean) => (isDemo ? { context: "Demo" } : {});
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(minor / 100);

  return [
    ...tenants.map((t): SearchHit => ({
      id: t.id,
      kind: "client",
      title: t.name,
      subtitle: `${t.plan} · ${t.status}`,
      href: `/clients/${t.id}`,
      ...demo(t.isDemo),
    })),
    ...properties.map((p): SearchHit => ({
      id: p.id,
      kind: "hotel",
      title: p.name,
      subtitle: p.tenant.name,
      href: `/clients/${p.tenantId}`,
      ...demo(p.tenant.isDemo),
    })),
    ...users.map((u): SearchHit => ({
      id: u.id,
      kind: "person",
      title: u.name || u.email,
      subtitle: `${u.email} · ${u.role} at ${u.tenant.name}`,
      href: `/clients/${u.tenantId}`,
      ...demo(u.tenant.isDemo),
    })),
    ...invoices.map((i): SearchHit => {
      const t = tenantById.get(i.tenantId);
      return {
        id: i.id,
        kind: "invoice",
        // A draft has no number yet — saying so is more useful than printing the period twice.
        title: i.number ?? `${i.period} (draft, no number yet)`,
        subtitle: `${t?.name ?? "unknown client"} · ${money(i.amountMinor, i.currency)} · ${i.status}`,
        href: "/billing",
        ...demo(t?.isDemo ?? false),
      };
    }),
    ...operatorPages(),
  ];
}

/**
 * The screens, taken from `navigation.ts` rather than restated.
 *
 * ⚠️ That file is stated to be "the only place that decides what belongs where", and a second list
 * of the console's own screens would be wrong the first time a section is renamed — with the palette
 * quietly sending people to the old name. Deriving it means a menu change reaches search for free.
 */
function operatorPages(): SearchHit[] {
  return OPERATOR_AREAS.flatMap((area) =>
    area.sections.length === 0
      ? [{ id: area.href, kind: "page" as const, title: area.label, href: area.href }]
      : area.sections.map((s) => ({
          id: s.href,
          kind: "page" as const,
          title: s.label,
          subtitle: s.blurb ?? area.label,
          href: s.href,
        })),
  );
}
