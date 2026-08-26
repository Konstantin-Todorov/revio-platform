import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  CircleDot,
  Clock3,
  GitCommitHorizontal,
  Layers3,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import {
  PLATFORM_MILESTONES,
  initiativesFor,
  type MilestoneKind,
  type PlatformInitiative,
  type RoadmapHorizon,
} from "@/lib/platform-history";

const KIND: Record<MilestoneKind, { label: string; icon: typeof Blocks; tone: Tone; line: string }> = {
  foundation: { label: "Foundation", icon: Blocks, tone: "info", line: "bg-accent-500" },
  product: { label: "Product", icon: Layers3, tone: "success", line: "bg-success-500" },
  security: { label: "Security", icon: ShieldCheck, tone: "warning", line: "bg-warning-500" },
  reliability: { label: "Reliability", icon: Wrench, tone: "danger", line: "bg-danger-500" },
  commercial: { label: "Commercial", icon: Rocket, tone: "neutral", line: "bg-ink-400" },
};

const HORIZON: Record<RoadmapHorizon, { title: string; window: string; note: string; accent: string }> = {
  now: {
    title: "Now",
    window: "Launch readiness",
    note: "Committed outcomes. Adding one means moving another out.",
    accent: "border-t-danger-500",
  },
  next: {
    title: "Next",
    window: "First 90 days",
    note: "Expected next, once the launch controls are proven.",
    accent: "border-t-accent-500",
  },
  later: {
    title: "Later",
    window: "Directional bets",
    note: "Worthwhile, but deliberately not allowed to delay launch.",
    accent: "border-t-ink-300",
  },
};

const EFFORT: Record<PlatformInitiative["effort"], string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Extra large",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function RoadmapCard({ item }: { item: PlatformInitiative }) {
  return (
    <article className="rounded-lg border border-surface-border bg-white p-4 shadow-card transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={item.priority === "must" ? "danger" : item.priority === "should" ? "info" : "neutral"}>
          {item.priority}
        </StatusPill>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-500" title={EFFORT[item.effort]}>
          Effort {item.effort}
        </span>
        <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-400">{item.owner}</span>
      </div>
      <h3 className="mt-3 text-[14px] font-bold tracking-tight text-ink-900">{item.title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-5 text-ink-600">{item.outcome}</p>
      {item.dependency && (
        <div className="mt-3 border-t border-surface-border pt-2.5 text-[11.5px] leading-4 text-ink-500">
          <span className="font-semibold text-ink-700">Depends on:</span> {item.dependency}
        </div>
      )}
    </article>
  );
}

export default function PlatformHistoryPage() {
  const first = PLATFORM_MILESTONES[0]!;
  const last = PLATFORM_MILESTONES[PLATFORM_MILESTONES.length - 1]!;

  return (
    <div>
      <PageHeader
        title="Platform history"
        subtitle="The decisions that formed Revio, the evidence behind them, and what earns the next release"
      />

      <section className="relative overflow-hidden rounded-xl border border-brand-800 bg-brand-900 px-5 py-5 text-white shadow-card lg:px-6">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" />
        <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full border border-product-mark/20" />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-white/45">
              <GitCommitHorizontal className="h-4 w-4 text-product-mark" /> Operating record
            </div>
            <h2 className="mt-3 max-w-2xl text-[24px] font-bold leading-tight tracking-[-0.025em] text-white lg:text-[28px]">
              Every milestone changed what the platform could safely promise.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-white/60">
              Git holds every change. This screen keeps the smaller set an operator needs to explain: what became true, why it mattered, and which evidence proves it.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10">
            {[
              [String(PLATFORM_MILESTONES.length), "milestones"],
              [formatDate(first.date).replace(/\s2026$/, ""), "foundation"],
              [formatDate(last.date).replace(/\s2026$/, ""), "latest gate"],
            ].map(([value, label]) => (
              <div key={label} className="bg-brand-900/90 px-3 py-3.5 text-center">
                <div className="tnum text-[17px] font-bold text-white">{value}</div>
                <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/35">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { icon: Blocks, title: "One core", text: "Availability, rates and reservations remain platform facts — never app-owned copies." },
          { icon: LockKeyhole, title: "Proof before promise", text: "A release is recorded here only when code, tests or a live control can support the claim." },
          { icon: ArrowRight, title: "Launch before breadth", text: "Now closes trust and operating risk. New product surface stays behind it." },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title} className="flex gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-600">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-ink-900">{title}</h3>
              <p className="mt-1 text-[11.5px] leading-4 text-ink-500">{text}</p>
            </div>
          </Card>
        ))}
      </section>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">From foundation to operating company</div>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight text-ink-900">Milestone ledger</h2>
        </div>
        <div className="hidden text-right text-[11.5px] text-ink-400 md:block">Curated from Git · oldest first</div>
      </div>

      <section className="relative mt-4">
        <div className="absolute bottom-5 left-[17px] top-5 w-px bg-surface-border md:left-[132px]" aria-hidden="true" />
        <ol className="space-y-3">
          {PLATFORM_MILESTONES.map((item) => {
            const meta = KIND[item.kind];
            const Icon = meta.icon;
            return (
              <li key={item.id} className="relative grid grid-cols-[35px_1fr] gap-3 md:grid-cols-[115px_35px_1fr]">
                <time className="hidden pt-4 text-right text-[11.5px] font-semibold text-ink-400 md:block" dateTime={item.date}>
                  {formatDate(item.date)}
                </time>
                <div className={`relative z-10 mt-3 flex h-[35px] w-[35px] items-center justify-center rounded-full border-4 border-surface-muted ${meta.line} text-white`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                </div>
                <Card className="overflow-hidden">
                  <div className={`h-0.5 ${meta.line}`} />
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      <time className="text-[11px] font-semibold text-ink-400 md:hidden" dateTime={item.date}>{formatDate(item.date)}</time>
                      <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                        {item.evidence.map((proof) => (
                          <span key={proof} className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-500">{proof}</span>
                        ))}
                      </div>
                    </div>
                    <h3 className="mt-2.5 text-[14px] font-bold tracking-tight text-ink-900">{item.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-ink-600">{item.summary}</p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3 border-t border-surface-border pt-7">
        <div>
          <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            <Sparkles className="h-3.5 w-3.5" /> Decision order
          </div>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight text-ink-900">Launch roadmap</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink-500">Priority says whether the launch succeeds without it. Effort describes shape, not a promised date.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
          <CircleDot className="h-3.5 w-3.5 text-danger-500" /> Must
          <span className="mx-1 text-ink-300">·</span>
          <Clock3 className="h-3.5 w-3.5 text-accent-500" /> Should
          <span className="mx-1 text-ink-300">·</span>
          <CheckCircle2 className="h-3.5 w-3.5 text-ink-400" /> Could
        </div>
      </div>

      <section className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        {(["now", "next", "later"] as const).map((horizon) => {
          const meta = HORIZON[horizon];
          const items = initiativesFor(horizon);
          return (
            <div key={horizon} className={`rounded-xl border border-surface-border border-t-4 bg-surface-muted/50 p-3 ${meta.accent}`}>
              <div className="px-1 pb-3 pt-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[16px] font-bold tracking-tight text-ink-900">{meta.title}</h3>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">{meta.window}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-4 text-ink-500">{meta.note}</p>
              </div>
              <div className="space-y-3">
                {items.map((item) => <RoadmapCard key={item.id} item={item} />)}
              </div>
            </div>
          );
        })}
      </section>

      <p className="mt-4 text-[11.5px] leading-5 text-ink-400">
        This is an internal decision record, not a customer promise. Detailed implementation remains in Git and the module guides; external dependencies stay visible here so engineering work is never mistaken for a decision only a hotel, accountant or provider can make.
      </p>
    </div>
  );
}
