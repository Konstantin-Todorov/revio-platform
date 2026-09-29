import Link from "next/link";
import { getClients } from "@/lib/data";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { ACCOUNT_TYPE_BY_KEY, PRODUCT_BY_KEY, statusView, syncRecencyHealth, isOurs } from "@revio/core";
import { describeBilling } from "@revio/db";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { AccountTypeChip } from "@/components/clients/AccountTypeChip";
import { RowLink } from "@/components/clients/RowLink";
import { renewalStatus } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * Every client, in three piles that never mix: the business, the ones that left, and ours.
 *
 * ## ⚠️ Nothing in a row changes anything (2026-09-28)
 *
 * Every row used to carry three product switches and a Suspend button, each one click, no question,
 * no record. That is how a real hotel lost all three products in two seconds. A row now only opens
 * the client; every change lives on the client's own page, in a dialog that asks why.
 * (Borrowed from Stripe and Shopify, whose lists are for finding, and whose actions sit on the record.)
 */
type View = "clients" | "closed" | "ours";
const VIEWS: { key: View; label: string; blurb: string }[] = [
  { key: "clients", label: "Clients & pilots", blurb: "Live clients and pilots — the business." },
  { key: "closed", label: "Closed", blurb: "Left or contract ended. Data kept for 90 days; can be reopened." },
  { key: "ours", label: "Demo & test", blurb: "Ours. Never billed, never counted, removable at any time." },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view: View = requested === "closed" || requested === "ours" ? requested : "clients";
  const all = await getClients();
  const now = new Date();

  const pile = (c: (typeof all)[number]): View =>
    isOurs(c.accountType) ? "ours" : c.status === "closed" ? "closed" : "clients";
  const counts = { clients: 0, closed: 0, ours: 0 } as Record<View, number>;
  for (const c of all) counts[pile(c)]++;
  const clients = all.filter((c) => pile(c) === view);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Find a hotel and open it. Every change to a client is made on its own page and asks why."
        action={<CreateClientDialog />}
      />

      <nav aria-label="Client groups" className="mb-3 flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "clients" ? "/clients" : `/clients?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={`flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
              view === v.key ? "border-brand-800 bg-brand-800 text-white" : "border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {v.label}
            <span className={`tnum rounded px-1.5 text-[11px] ${view === v.key ? "bg-white/20" : "bg-surface-muted text-ink-500"}`}>{counts[v.key]}</span>
          </Link>
        ))}
      </nav>
      <p className="mb-3 text-[12.5px] text-ink-500">{VIEWS.find((v) => v.key === view)!.blurb}</p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                {["Client", "Status", "Billing", "Products", "Health", "Who to call"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-400">
                    {view === "clients" ? (
                      <>No clients yet. <span className="font-semibold text-ink-500">New client</span> creates the organisation, its first property and the owner&rsquo;s login.</>
                    ) : view === "closed" ? "No closed clients." : "No demo or test accounts."}
                  </td>
                </tr>
              )}
              {clients.map((c) => {
                const st = statusView(c.status, c.closedAt);
                const products = (["cm", "crs", "pms"] as const).filter((k) =>
                  k === "cm" ? c.entitlements.channelManager : k === "crs" ? c.entitlements.reservation : c.entitlements.pms,
                );
                const health = c.status === "active" && c.counts.channelsConnected > 0 ? syncRecencyHealth(c.lastSuccessAt, now) : null;
                return (
                  <RowLink key={c.id} href={`/clients/${c.id}`} className="border-b border-surface-border/60 align-top transition-colors last:border-0 hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.worst && (
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${c.worst === "act" ? "bg-danger-600" : c.worst === "soon" ? "bg-warning-500" : "bg-ink-300"}`} />
                        )}
                        <Link href={`/clients/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">{c.name}</Link>
                        <AccountTypeChip type={c.accountType} />
                      </div>
                      <div className="text-[11px] text-ink-400">{c.properties.map((p) => p.name).join(" · ")}</div>
                      {c.attention.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {c.attention.slice(0, 2).map((f) => (
                            <li key={f.title} title={f.detail} className={`text-[11px] ${f.severity === "act" ? "font-semibold text-danger-600" : f.severity === "soon" ? "text-warning-600" : "text-ink-400"}`}>
                              {f.title}
                            </li>
                          ))}
                          {c.attention.length > 2 && <li className="text-[11px] text-ink-300">+{c.attention.length - 2} more on their page</li>}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      {c.statusReason && c.status !== "active" && <div className="mt-1 max-w-[14rem] text-[11px] text-ink-400">{c.statusReason}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-700">
                      {describeBilling(c.billingMode, c.freeUntil)}
                      {c.account.renewalDate && c.billingMode === "paying" && (() => {
                        const r = renewalStatus(c.account.renewalDate);
                        return <div className={`tnum mt-1 text-[11px] ${r ? "font-semibold text-warning-600" : "text-ink-400"}`}>renews {c.account.renewalDate.toISOString().slice(0, 10)}</div>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {products.length === 0 && <span className="text-[12px] text-ink-300">none</span>}
                        {products.map((k) => {
                          const trial = c.productTrials.find((t) => t.product === k);
                          const left = trial ? Math.max(0, Math.ceil((trial.endsAt.getTime() - now.getTime()) / 86_400_000)) : null;
                          return (
                            <span key={k} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-ink-600">
                              {PRODUCT_BY_KEY[k].name}{left !== null && <span className="font-normal text-warning-600"> · trial {left}d</span>}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {health && health.health !== "healthy" ? (
                        <span {...(health.detail ? { title: health.detail } : {})}>
                          <StatusPill tone={health.health === "dead" ? "danger" : "warning"}>{health.label}</StatusPill>
                        </span>
                      ) : health ? (
                        <StatusPill tone="success">Syncing</StatusPill>
                      ) : (
                        <span className="text-[12px] text-ink-300">{c.counts.channelsConnected === 0 ? "No channels" : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.account.primaryContact ? (
                        <>
                          <div className="text-ink-800">{c.account.primaryContact.name}</div>
                          <div className="text-[11px] text-ink-400">{c.account.primaryContact.phone ?? c.account.primaryContact.email}</div>
                        </>
                      ) : c.owner ? (
                        <>
                          <div className="text-ink-800">{c.owner.name}</div>
                          <div className="text-[11px] text-ink-300">login · no contact recorded</div>
                        </>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-[12px] text-ink-400">
        Account types: {Object.values(ACCOUNT_TYPE_BY_KEY).map((t) => `${t.label} — ${t.blurb}`).join(" ")}
      </p>
    </div>
  );
}
