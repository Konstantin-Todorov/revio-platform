import Link from "next/link";
import { forSystem } from "@revio/db";
import { SUPPORT_KINDS, SUPPORT_SOURCES, hoursOverdue, isOverdue } from "@revio/core";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { SupportCase, type SupportCaseRow } from "@/components/support/SupportCase";
import { logSupportRequest } from "@/lib/actions-support";

export const dynamic = "force-dynamic";

const prisma = forSystem();

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

/**
 * The support queue — what hotels have asked, and what is late.
 *
 * Ordered by **how late against what we promised**, not by how loudly it was reported. A question
 * asked four days ago is more overdue than an urgent raised ten minutes ago, and sorting by severity
 * would bury it forever. The promise and the clock come from the same constants the hotel was shown.
 *
 * Answered requests stay visible, because "have we heard from this client before?" is a question a
 * renewal call asks and a queue that empties itself cannot answer. They are shown by the **same**
 * card as a waiting one — see `SupportCase` — because when they were separate markup the answered
 * half lost the source, the thread and the reply box, which is most of what a renewal call wants.
 *
 * Three tabs rather than three stacked lists. Everything used to be on one screen at once: the
 * log-a-call form, every open case with its thread expanded, and the answered list underneath. Past
 * a handful of cases that is unreadable, and the thing being looked for is never the thing at the
 * top.
 */

type Tab = "open" | "answered" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "all", label: "All" },
];

/** Said on the tab rather than in a heading, so the list underneath is what it describes. */
const TAB_NOTE: Record<Tab, string> = {
  open: "Sorted by how late, not by how it was labelled",
  answered: "Kept — a renewal call asks what they have reported before",
  all: "Newest first",
};

const EMPTY: Record<Tab, string> = {
  open: "Nothing is waiting. Requests arrive here the moment a hotel presses “Get help”, and are emailed at the same time — the queue reads this table rather than an inbox, so a mail provider having a bad minute cannot lose one.",
  answered: "Nothing answered yet.",
  all: "No requests yet.",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const requested = (await searchParams).tab;
  const tab: Tab = requested === "answered" || requested === "all" ? requested : "open";

  const now = new Date();
  const [requests, tenants] = await Promise.all([
    prisma.supportRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.tenant.findMany({ select: { id: true, name: true, isDemo: true } }),
  ]);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const open = requests
    .filter((r) => !r.handledAt)
    .sort((a, b) => hoursOverdue(b, now) - hoursOverdue(a, now) || a.createdAt.getTime() - b.createdAt.getTime());
  const answered = requests.filter((r) => r.handledAt);
  const overdue = open.filter((r) => isOverdue(r, now)).length;

  const shown = tab === "open" ? open : tab === "answered" ? answered : requests;
  const counts: Record<Tab, number> = { open: open.length, answered: answered.length, all: requests.length };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support"
        subtitle={
          open.length === 0
            ? "Nothing waiting"
            : `${open.length} waiting${overdue > 0 ? ` · ${overdue} past the window we promised` : ""}`
        }
      />

      <Card>
        <CardHeader
          title="Log a call, an email or a conversation"
          subtitle="So a question asked on the phone counts the same as one typed into the app"
        />
        <form action={logSupportRequest} className="grid gap-3 px-4 py-4 lg:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Client</span>
            <select name="tenantId" required className={inputCls} defaultValue="">
              <option value="" disabled>Choose…</option>
              {tenants
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDemo ? " (demo)" : ""}</option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>How it reached us</span>
            <select name="source" className={inputCls} defaultValue="phone">
              {SUPPORT_SOURCES.filter((s) => s.key !== "app").map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Product</span>
            <select name="product" className={inputCls} defaultValue="crs">
              <option value="cm">RevioLink</option>
              <option value="crs">RevioCRS</option>
              <option value="pms">RevioPMS</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Urgency</span>
            <select name="kind" className={inputCls} defaultValue="problem">
              {SUPPORT_KINDS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className={labelCls}>What did they ask?</span>
            <textarea
              name="message"
              rows={3}
              required
              placeholder="Rang to ask where they change the check-in time. Told them Settings → Property."
              className={inputCls}
            />
          </label>
          <p className="text-[11.5px] text-ink-400 lg:col-span-2">
            Their own words if you have them — this is what the help gets written from. No email is
            sent: you already have them on the phone.
          </p>
          <div className="lg:col-span-2">
            <button className="h-[34px] rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              Log it
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-1 border-b border-surface-border px-3 py-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "open" ? "/support" : `/support?tab=${t.key}`}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                tab === t.key ? "bg-brand-800 text-white" : "text-ink-500 hover:bg-surface-muted hover:text-ink-900"
              }`}
            >
              {t.label} ({counts[t.key]})
            </Link>
          ))}
          <span className="ml-auto pr-1 text-[11.5px] text-ink-400">{TAB_NOTE[tab]}</span>
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-500">{EMPTY[tab]}</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {shown.map((r) => (
              <li key={r.id} className="px-4 py-3.5">
                <SupportCase
                  request={r as unknown as SupportCaseRow}
                  tenant={tenantById.get(r.tenantId)}
                  now={now}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
