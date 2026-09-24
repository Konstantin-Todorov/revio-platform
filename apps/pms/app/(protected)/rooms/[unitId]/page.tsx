import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Play, CircleCheck, Wrench, Ban, User, CircleDot } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { getRoomTimeline, type RoomEvent } from "@/lib/maintenance";
import { HK_TONE, type HkStatus } from "@/lib/hk-meta";
import { i18n } from "@/lib/i18n/server";
import { rooms, type RoomsStrings } from "@/lib/i18n/rooms";
import { common } from "@/lib/i18n/common";

export const dynamic = "force-dynamic";

const ICON: Record<RoomEvent["kind"], typeof CircleDot> = {
  clean: CircleCheck, in_progress: Play, inspected: CircleCheck, ooo: Ban,
  issue: Wrench, repaired: CircleCheck, guest: User, other: CircleDot,
};
const TINT: Record<RoomEvent["kind"], string> = {
  clean: "bg-success-100 text-success-700", in_progress: "bg-brand-100 text-brand-700",
  inspected: "bg-accent-100 text-accent-700", ooo: "bg-danger-100 text-danger-700",
  issue: "bg-warning-100 text-warning-700", repaired: "bg-success-100 text-success-700",
  guest: "bg-brand-100 text-brand-700", other: "bg-ink-100 text-ink-500",
};

function fmt(d: Date, intl: string): string {
  return d.toLocaleString(intl, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** The event sentence in the reader's language, from its code; the English `label` otherwise. */
function eventText(e: RoomEvent, s: RoomsStrings["timeline"], priorities: Record<string, string>): { label: string; detail?: string } {
  switch (e.code) {
    case "hk": return { label: s.hk[e.status ?? ""] ?? s.statusTo(e.status ?? "") };
    case "issue_reported": return { label: s.issueReported, ...(e.detail ? { detail: e.detail } : {}) };
    case "issue_logged": return { label: s.issueLogged(e.subject ?? ""), detail: e.setsOoo ? s.tookOoo : s.priority(priorities[e.priority ?? ""] ?? e.priority ?? "") };
    case "repaired": return { label: s.repaired(e.subject ?? ""), detail: s.backInService };
    case "checked_in": return { label: s.checkedIn(e.subject ?? "") };
    case "checked_out": return { label: s.checkedOut(e.subject ?? "") };
    default: return { label: e.label, ...(e.detail ? { detail: e.detail } : {}) };
  }
}

export default async function RoomTimelinePage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const data = await getRoomTimeline(unitId);
  if (!data) notFound();
  const { unit, events } = data;
  const { t, locale } = await i18n();
  const s = t(rooms).timeline;
  const c = t(common);
  const priorities = locale === "bg" ? { low: "ниска", normal: "нормална", high: "висока" } : { low: "low", normal: "normal", high: "high" };
  const intl = locale === "bg" ? "bg-BG" : "en-GB";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/rooms" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-700">
        <ArrowLeft className="h-4 w-4" /> {s.back}
      </Link>
      <PageHeader
        title={s.title(unit.label)}
        subtitle={s.subtitle(unit.roomType, unit.floor)}
        action={<StatusPill tone={HK_TONE[unit.hkStatus as HkStatus]}>{c.statuses[unit.hkStatus as HkStatus]}</StatusPill>}
      />

      <Card>
        <CardHeader title={s.card} subtitle={s.cardSub} />
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-ink-400">{s.empty}</div>
        ) : (
          <ol className="p-4">
            {events.map((e, i) => {
              const Icon = ICON[e.kind];
              const text = eventText(e, s, priorities);
              return (
                <li key={i} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TINT[e.kind]}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-surface-border" />}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-[13px] font-semibold text-ink-900">{text.label}</div>
                    {text.detail && <div className="text-[12px] text-ink-500">{text.detail}</div>}
                    <div className="tnum text-[11px] text-ink-400">{fmt(e.at, intl)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <Sparkles className="h-3.5 w-3.5" /> {s.footnote}
      </p>
    </div>
  );
}
