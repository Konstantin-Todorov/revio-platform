import { forSystem } from "@revio/db";
import {
  PRODUCT_BY_KEY,
  SUPPORT_KINDS,
  SUPPORT_SOURCES,
  hoursOverdue,
  isOverdue,
  supportKind,
  supportReference,
  supportSourceLabel,
} from "@revio/core";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { logSupportRequest, markSupportHandled } from "@/lib/actions-support";

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
 * Answered requests stay visible below, because "have we heard from this client before?" is a
 * question a renewal call asks and a queue that empties itself cannot answer.
 */
export default async function SupportPage() {
  const now = new Date();
  const [requests, tenants] = await Promise.all([
    prisma.supportRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.tenant.findMany({ select: { id: true, name: true, isDemo: true } }),
  ]);
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const open = requests
    .filter((r) => !r.handledAt)
    .sort((a, b) => hoursOverdue(b, now) - hoursOverdue(a, now) || a.createdAt.getTime() - b.createdAt.getTime());
  const handled = requests.filter((r) => r.handledAt).slice(0, 25);
  const overdue = open.filter((r) => isOverdue(r, now)).length;

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

      {/*
        Log what arrived some other way.

        The queue only recorded the in-app form, so it only knew about the half of a hotel that
        types. Somebody who telephones asks the same questions — often the more urgent ones, because
        they picked up the phone — and those left no trace at all, which would have meant writing the
        help for the wrong audience.
      */}
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
        <CardHeader title={`Waiting (${open.length})`} subtitle="Sorted by how late, not by how it was labelled" />
        {open.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-500">
            Nothing is waiting. Requests arrive here the moment a hotel presses “Get help”, and are
            emailed at the same time — the queue reads this table rather than an inbox, so a mail
            provider having a bad minute cannot lose one.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {open.map((r) => {
              const k = supportKind(r.kind);
              const late = isOverdue(r, now);
              const t = tenantById.get(r.tenantId);
              return (
                <li key={r.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-[12px] font-semibold text-ink-900">{supportReference(r.id)}</span>
                    <StatusPill tone={late ? "danger" : k.key === "urgent" ? "warning" : "neutral"}>
                      {late ? `${Math.round(hoursOverdue(r, now))}h late` : k.key}
                    </StatusPill>
                    <span className="text-[13px] font-semibold text-ink-900">{t?.name ?? "Unknown client"}</span>
                    {t?.isDemo ? <StatusPill tone="neutral">demo</StatusPill> : null}
                    <span className="text-[11.5px] text-ink-400">
                      {PRODUCT_BY_KEY[r.product as "cm" | "crs" | "pms"]?.name ?? r.product}
                      {r.route ? ` · ${r.route}` : ""}
                      {r.source !== "app" ? ` · ${supportSourceLabel(r.source)}` : ""}
                    </span>
                    <span className="ml-auto text-[11.5px] text-ink-400">
                      {r.contactName} · {r.contactEmail}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">{r.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <a
                      href={`mailto:${r.contactEmail}?subject=${encodeURIComponent(`Re: ${supportReference(r.id)}`)}`}
                      className="text-[12px] font-semibold text-brand-700 hover:underline"
                    >
                      Reply by email
                    </a>
                    <form action={markSupportHandled}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-[12px] font-semibold text-ink-500 transition-colors hover:text-ink-900">
                        Mark answered
                      </button>
                    </form>
                    <span className="text-[11.5px] text-ink-400">
                      asked {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} · promised {k.targetHours}h
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Answered" subtitle="Kept, because a renewal call asks what they have reported before" />
        {handled.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-ink-500">Nothing answered yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-2 px-4 py-2.5 text-[12.5px]">
                <span className="tnum font-semibold text-ink-700">{supportReference(r.id)}</span>
                <span className="text-ink-900">{tenantById.get(r.tenantId)?.name ?? "Unknown"}</span>
                <span className="truncate text-ink-500">{r.message.slice(0, 90)}</span>
                <span className="ml-auto text-[11.5px] text-ink-400">
                  answered {r.handledAt?.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
