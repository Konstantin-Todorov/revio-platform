import type { ChannelPlanLine, ChannelPlanRole, ChannelPlanRoom } from "@revio/connectivity";
import { StatusPill, type Tone } from "@/components/ui/primitives";
import type { CmMappingStrings } from "@/lib/i18n/mapping";

/**
 * Every plan the channel holds, grouped by its room, each with the one sentence that says where its
 * price comes from.
 *
 * ## Why (founder, 2026-09-29)
 *
 * The tables above list only what we map TO. A hotel that opens Channex sees twelve plans for three
 * apartments and six rows here, and has no way to tell which of the other six should have been
 * mapped — the founder could not either, reading the read-back's "186 prices we did not send". The
 * answer was "none of them: they are Channex's copies for Booking.com and follow their parent", and
 * that answer belongs on the screen, not in a conversation.
 *
 * Shape borrowed from the thing it describes: a chain, parent first and what follows it indented
 * under it, so "BB BAR - BookingCom" reads as coming from BB BAR before a word is read.
 * Colour carries the verdict: neutral is correct and needs nothing, amber needs a decision, red is
 * wrong. The common case — a catalogue that is entirely correct — is mostly grey, as it should be.
 */
const TONE: Record<ChannelPlanRole, Tone> = {
  ours: "success", ours_ignored: "warning", ota_mapped: "danger", derived: "neutral", ota_copy: "neutral", unused: "warning",
};

/** Channex's suffix spelling, as a person writes the OTA's name. */
const otaName = (c?: string) => (c === "BookingCom" ? "Booking.com" : c ?? "");

export function ChannelPlans({ rooms, channel, s }: { rooms: ChannelPlanRoom[]; channel: string; s: CmMappingStrings["plans"] }) {
  const all = rooms.flatMap((r) => r.plans);
  if (all.length === 0) return null;
  // Open when there is something to decide; a catalogue that is all "price from Revio" and copies
  // that follow it is a fact worth one click, not a panel that pushes the tables down every visit.
  const needsLook = all.some((p) => p.role === "ours_ignored" || p.role === "ota_mapped" || p.role === "unused");

  const sentence = (p: ChannelPlanLine) => {
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
    <details open={needsLook} className="group mt-4 rounded-lg border border-surface-border bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-[13.5px] font-semibold text-ink-900">
          <span aria-hidden className="mr-1.5 inline-block text-ink-400 transition-transform group-open:rotate-90">›</span>
          {s.title(channel)}
        </span>
        <span className="text-[11.5px] text-ink-400">{s.count(all.length)}</span>
      </summary>
      <div className="border-t border-surface-border px-4 pb-4 pt-3">
        <p className="mb-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-500">{s.lead(channel)}</p>
        <div className="space-y-4">
          {rooms.map((room) => {
            // Chain order: a plan, then whatever the channel builds from it, indented beneath.
            const byParent = new Map<string, ChannelPlanLine[]>();
            const ids = new Set(room.plans.map((p) => p.name));
            const roots: ChannelPlanLine[] = [];
            for (const p of room.plans) {
              if (p.parent && ids.has(p.parent)) byParent.set(p.parent, [...(byParent.get(p.parent) ?? []), p]);
              else roots.push(p);
            }
            const rows: { p: ChannelPlanLine; depth: number }[] = [];
            const walk = (p: ChannelPlanLine, depth: number) => {
              rows.push({ p, depth });
              for (const c of byParent.get(p.name) ?? []) walk(c, depth + 1);
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
                      <p className={`mt-0.5 text-[12px] leading-snug ${p.role === "ota_mapped" ? "text-danger-700" : p.role === "ours_ignored" || p.role === "unused" ? "text-warning-700" : "text-ink-500"}`}>
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
