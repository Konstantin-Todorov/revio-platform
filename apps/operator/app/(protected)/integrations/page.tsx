import Link from "next/link";
import { ArrowRight, CreditCard, Mail, Plug, Radio, ShieldCheck } from "lucide-react";
import { Card, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getIntegrations, type IntegrationRow, type IntegrationState } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Every connection the platform depends on, on one page.
 *
 * ## The shape this borrows
 *
 * A settings "Connections" list — the pattern Slack, Notion, Linear and every provider console uses,
 * because it is the one people already know: one row per service, a state you can read at a glance,
 * and the detail one click in. `docs/UI-STANDARD.md` rule 1.
 *
 * ## Why the state pill is the leftmost thing
 *
 * It is the only reason anybody opens this page. "Which of these is broken" has to be answerable
 * without reading a word — position and colour carry it, and the sentence beside it only confirms
 * (rule 2). The rows are ordered with what we manage here first, because those are the ones a person
 * on this screen can actually do something about.
 */

const ICONS: Record<string, typeof Plug> = {
  stripe: CreditCard,
  channex: Radio,
  email: Mail,
  "support-mailbox": ShieldCheck,
};

/**
 * Four states, four colours, and **`untested` is deliberately not green**.
 *
 * `ConnectivityCredential` learned this on 2026-09-01: a revoked key sat on a screen looking healthy
 * while a real hotel's channel did nothing for hours. A credential nobody has exercised is not a
 * working credential, it is a hope, and colouring it green is the screen telling a lie it was asked
 * to check.
 */
const STATE: Record<IntegrationState, { tone: "success" | "danger" | "warning" | "neutral"; label: string }> = {
  working: { tone: "success", label: "working" },
  rejected: { tone: "danger", label: "rejected" },
  untested: { tone: "warning", label: "never tested" },
  not_configured: { tone: "neutral", label: "not set up" },
  elsewhere: { tone: "neutral", label: "set elsewhere" },
};

function ago(d: Date): string {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function Row({ row }: { row: IntegrationRow }) {
  const Icon = ICONS[row.key] ?? Plug;
  const s = STATE[row.state];

  const body = (
    <div className="flex items-start gap-3.5 px-4 py-3.5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken">
        <Icon className="h-[18px] w-[18px] text-ink-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-ink-900">{row.name}</span>
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          {row.mode && (
            <span
              className={
                row.mode === "live"
                  ? "rounded bg-danger-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-danger-700"
                  : "rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-500"
              }
            >
              {/* Live is red, everywhere, always. It is the one word on this page that means real
                  money is moving, and it should never be able to hide among the neutral chips. */}
              {row.mode}
            </span>
          )}
          {row.hint && (
            <span className="tnum rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">{row.hint}</span>
          )}
        </div>

        <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{row.purpose}</p>

        {row.lastCheckMessage && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
            {row.lastCheckMessage}
            {row.lastCheckedAt && <span className="text-ink-300"> · checked {ago(row.lastCheckedAt)}</span>}
          </p>
        )}
      </div>

      {row.href && <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-300" />}
    </div>
  );

  const cls = "block border-b border-surface-border last:border-0 transition-colors hover:bg-surface-muted";
  return row.href ? (
    <Link href={row.href} className={cls}>{body}</Link>
  ) : (
    <div className="border-b border-surface-border last:border-0">{body}</div>
  );
}

export default async function IntegrationsPage() {
  const rows = await getIntegrations();
  const managed = rows.filter((r) => r.managedHere);
  const external = rows.filter((r) => !r.managedHere);

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Everything Revio connects to, and whether it is actually working."
      />

      {/*
        * The sentence that earns the page.
        *
        * Three of the four connections below fail SILENTLY: a rolled Stripe key, an unset mail key
        * and an unread mailbox all look exactly like a quiet day. That is the specific thing this
        * screen ends, and saying so is the difference between a list and a reason to open it.
        */}
      <p className="mb-4 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-500">
        Most of these fail quietly. A rolled key, an unset variable or an unread mailbox looks
        identical to nothing happening — so the state is checked and recorded here rather than
        discovered later by whatever depended on it.
      </p>

      <Card className="mb-4 overflow-hidden">
        <div className="border-b border-surface-border bg-surface-sunken px-4 py-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Managed here</h3>
        </div>
        {managed.map((r) => <Row key={r.key} row={r} />)}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-surface-border bg-surface-sunken px-4 py-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Configured elsewhere</h3>
        </div>
        {external.map((r) => <Row key={r.key} row={r} />)}
      </Card>

      <p className="mt-3 max-w-[68ch] text-[11.5px] leading-relaxed text-ink-400">
        The lower group is set with environment variables in Railway rather than on a screen, because
        those services read them at boot. This console cannot read another service&rsquo;s
        environment, so where it says <em>set elsewhere</em> it means exactly that — not that
        something is missing.
      </p>
    </div>
  );
}
