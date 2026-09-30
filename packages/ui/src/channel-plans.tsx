import { CheckCircle2, AlertTriangle } from "lucide-react";
import { StatusPill, type Tone } from "./primitives";
import { translate, type Locale, type Translations } from "./i18n";

/**
 * Every plan a channel holds, grouped by its room and drawn as a chain, each with the one sentence
 * that says where its price comes from. RevioLink's Mapping screen and the Operator's client
 * Channels tab show the same thing, so it is one component (UI-STANDARD §3).
 *
 * ## Why (founder, 2026-09-29)
 *
 * The first production read-back reported 186 prices "we did not send" on Cabacum. They were all
 * Channex's own copies of a plan for Booking.com — correct, and not to be mapped — and nobody could
 * tell that from any screen: the Mapping tables list only what we map TO.
 *
 * ## ⚠️ Green means "works", whatever produces the price
 *
 * The first version drew the channel's automatic plans in grey. The founder's reading, correctly:
 * grey is what software uses for "switched off" or "not finished", so a screen full of grey reads
 * as work still to do. A plan the channel calculates from ours IS working — so it is green, labelled
 * "Automatic", and a verdict line above the list says in one sentence whether anything needs doing.
 * Amber and red are kept for the two things that do: a price of ours being thrown away, and a plan
 * nothing feeds. The shape answers before the words do.
 */

export type ChannelPlanRoleView = "ours" | "ours_ignored" | "ota_mapped" | "derived" | "ota_copy" | "unused";

/** Structurally `@revio/connectivity`'s `ChannelPlanRoom`; restated so this package depends on no app-facing logic. */
export interface ChannelPlanRoomView {
  roomId: string | null;
  roomName: string | null;
  plans: { id: string; name: string; role: ChannelPlanRoleView; revioPlans: string[]; parent: string | null; channel?: string }[];
}

export interface ChannelPlansStrings {
  title: (channel: string) => string;
  lead: (channel: string) => string;
  allGood: (fromRevio: number, automatic: number) => string;
  toDecide: (n: number) => string;
  roomless: string;
  count: (n: number) => string;
  pill: (role: ChannelPlanRoleView, channel: string, ota: string) => string;
  ours: (revio: string) => string;
  oursIgnored: (revio: string, parent: string | null, channel: string) => string;
  otaMapped: (revio: string, channel: string, parent: string | null) => string;
  derived: (parent: string | null, channel: string) => string;
  otaCopy: (ota: string, parent: string | null, channel: string) => string;
  unused: (channel: string) => string;
}

const bgPlans = (n: number) => `${n} ${n === 1 ? "план" : "плана"}`;

export const channelPlansStrings: Translations<ChannelPlansStrings> = {
  en: {
    title: (c) => `Every plan in ${c}, and where its price comes from`,
    lead: (c) => `${c} always holds more plans than you map: plans it calculates from another, and its own copy of a plan for each OTA it sends to (named “… - BookingCom …”). Those work automatically — they follow the plan above them and are never mapped. Only the plans marked “Price from Revio” need a mapping.`,
    allGood: (r, a) => `${r} plan${r === 1 ? "" : "s"} on the channel take${r === 1 ? "s" : ""} the price from Revio${a ? `, ${a} follow${a === 1 ? "s" : ""} automatically` : ""}.`,
    toDecide: (n) => `${n} plan${n === 1 ? " needs" : "s need"} a decision — marked in amber or red below.`,
    roomless: "Plans the channel did not place in a room",
    count: (n) => `${n} plan${n === 1 ? "" : "s"}`,
    pill: (r, _c, o) => ({ ours: "Price from Revio", ours_ignored: "Revio's price ignored", ota_mapped: "Mapped to the wrong step", derived: "Automatic", ota_copy: `Automatic · ${o}`, unused: "Gets no price" })[r],
    ours: (r) => `Takes the price of your “${r}”.`,
    oursIgnored: (r, p, c) => `Mapped to your “${r}”, but ${c} calculates it${p ? ` from ${p}` : ""} and ignores that price — guests on the OTAs pay ${c}'s number, not yours.`,
    otaMapped: (r, c, p) => `Your “${r}” is mapped to ${c}'s copy for one OTA. Map it to ${p ?? "the plan this copies"} instead — that is the step Revio sends to.`,
    derived: (p, c) => `${c} calculates it${p ? ` from ${p}` : ""} automatically. Works — nothing to do.`,
    otaCopy: (o, p, c) => `What ${c} sends to ${o} — an automatic copy${p ? ` of ${p}` : ""}. Works — nothing to do.`,
    unused: (c) => `Not mapped and not calculated from anything, so no price from Revio reaches it. If an OTA sells it, it sells at whatever was last set in ${c} — map it, or close it in ${c}.`,
  },
  bg: {
    title: (c) => `Всички планове в ${c} и откъде идва цената им`,
    lead: (c) => `В ${c} винаги има повече планове, отколкото свързвате: планове, които ${c} изчислява от друг, и негово копие на план за всяка OTA, към която изпраща (с име „… - BookingCom …“). Те работят автоматично — следват плана над тях и никога не се свързват. Свързване трябва само на плановете с „Цена от Revio“.`,
    allGood: (r, a) => `${bgPlans(r)} в канала ${r === 1 ? "взима" : "взимат"} цената от Revio${a ? `, ${bgPlans(a)} ${a === 1 ? "следва" : "следват"} автоматично` : ""}.`,
    toDecide: (n) => `${bgPlans(n)} ${n === 1 ? "изисква" : "изискват"} решение — отбелязани в жълто или червено по-долу.`,
    roomless: "Планове, които каналът не е поставил в стая",
    count: (n) => bgPlans(n),
    pill: (r, _c, o) => ({ ours: "Цена от Revio", ours_ignored: "Цената от Revio се пренебрегва", ota_mapped: "Свързан към грешна стъпка", derived: "Автоматично", ota_copy: `Автоматично · ${o}`, unused: "Не получава цена" })[r],
    ours: (r) => `Взима цената на Вашия „${r}“.`,
    oursIgnored: (r, p, c) => `Свързан с Вашия „${r}“, но ${c} го изчислява${p ? ` от ${p}` : ""} и пренебрегва тази цена — гостите в OTA плащат цената на ${c}, а не Вашата.`,
    otaMapped: (r, c, p) => `Вашият „${r}“ е свързан с копието на ${c} за една OTA. Свържете го с ${p ?? "плана, който то копира"} — това е стъпката, към която Revio изпраща.`,
    derived: (p, c) => `${c} го изчислява${p ? ` от ${p}` : ""} автоматично. Работи — няма какво да правите.`,
    otaCopy: (o, p, c) => `Това ${c} изпраща към ${o} — автоматично копие${p ? ` на ${p}` : ""}. Работи — няма какво да правите.`,
    unused: (c) => `Не е свързан и не се изчислява от друг план, затова никаква цена от Revio не стига до него. Ако OTA го продава, продава на последната цена, зададена в ${c} — свържете го или го затворете в ${c}.`,
  },
};

const TONE: Record<ChannelPlanRoleView, Tone> = {
  ours: "success", derived: "success", ota_copy: "success", ours_ignored: "warning", unused: "warning", ota_mapped: "danger",
};
const NEEDS_DECISION = new Set<ChannelPlanRoleView>(["ours_ignored", "ota_mapped", "unused"]);

/** Channex's suffix spelling, as a person writes the OTA's name. */
const otaName = (c?: string) => (c === "BookingCom" ? "Booking.com" : c ?? "");

export function ChannelPlans({ rooms, channel, locale }: { rooms: ChannelPlanRoomView[]; channel: string; locale: Locale }) {
  const s = translate(channelPlansStrings, locale);
  const all = rooms.flatMap((r) => r.plans);
  if (all.length === 0) return null;
  const decide = all.filter((p) => NEEDS_DECISION.has(p.role)).length;
  const fromRevio = all.filter((p) => p.role === "ours").length;
  const automatic = all.filter((p) => p.role === "derived" || p.role === "ota_copy").length;

  const sentence = (p: ChannelPlanRoomView["plans"][number]) => {
    const revio = p.revioPlans.join(", ");
    switch (p.role) {
      case "ours": return s.ours(revio);
      case "ours_ignored": return s.oursIgnored(revio, p.parent, channel);
      case "ota_mapped": return s.otaMapped(revio, channel, p.parent);
      case "derived": return s.derived(p.parent, channel);
      case "ota_copy": return s.otaCopy(otaName(p.channel), p.parent, channel);
      case "unused": return s.unused(channel);
    }
  };

  return (
    // Open when there is something to decide; an all-green catalogue is one click away, not in the way.
    <details open={decide > 0} className="group mt-4 rounded-lg border border-surface-border bg-white">
      <summary className="cursor-pointer list-none px-4 py-3">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[13.5px] font-semibold text-ink-900">
            <span aria-hidden className="mr-1.5 inline-block text-ink-400 transition-transform group-open:rotate-90">›</span>
            {s.title(channel)}
          </span>
          <span className="text-[11.5px] text-ink-400">{s.count(all.length)}</span>
        </span>
        {/* The verdict, readable with the section closed. */}
        <span className={`mt-1 flex items-start gap-1.5 text-[12.5px] ${decide > 0 ? "text-warning-700" : "text-success-700"}`}>
          {decide > 0 ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {decide > 0 ? s.toDecide(decide) : s.allGood(fromRevio, automatic)}
        </span>
      </summary>
      <div className="border-t border-surface-border px-4 pb-4 pt-3">
        <p className="mb-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-500">{s.lead(channel)}</p>
        <div className="space-y-4">
          {rooms.map((room) => {
            // Chain order: a plan, then whatever the channel builds from it, indented beneath.
            type Line = ChannelPlanRoomView["plans"][number];
            const names = new Set(room.plans.map((p) => p.name));
            const children = new Map<string, Line[]>();
            const roots: Line[] = [];
            for (const p of room.plans) {
              if (p.parent && names.has(p.parent)) children.set(p.parent, [...(children.get(p.parent) ?? []), p]);
              else roots.push(p);
            }
            const rows: { p: Line; depth: number }[] = [];
            const walk = (p: Line, depth: number) => {
              rows.push({ p, depth });
              for (const c of children.get(p.name) ?? []) walk(c, depth + 1);
            };
            roots.forEach((p) => walk(p, 0));
            return (
              <section key={room.roomId ?? "none"} aria-label={room.roomName ?? s.roomless}>
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">{room.roomName ?? s.roomless}</h3>
                <ul className="divide-y divide-surface-border/60 rounded-md border border-surface-border/70">
                  {rows.map(({ p, depth }) => (
                    <li key={p.id} className="px-3 py-2" style={{ paddingLeft: `${0.75 + Math.min(depth, 3) * 1.25}rem` }}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {depth > 0 && <span aria-hidden className="text-ink-300">↳</span>}
                        <span className="min-w-0 break-words text-[12.5px] font-semibold text-ink-800">{p.name}</span>
                        <StatusPill tone={TONE[p.role]}>{s.pill(p.role, channel, otaName(p.channel))}</StatusPill>
                      </div>
                      <p className={`mt-0.5 text-[12px] leading-snug ${p.role === "ota_mapped" ? "text-danger-700" : NEEDS_DECISION.has(p.role) ? "text-warning-700" : "text-ink-500"}`}>
                        {sentence(p)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </details>
  );
}
