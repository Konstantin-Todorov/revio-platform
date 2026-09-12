import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { funnelSessions, type FunnelHold } from "@revio/core";
import { FunnelPanel } from "@/components/booking-engine/FunnelPanel";

/**
 * The funnel panel, rendered.
 *
 *     FUNNEL_PREVIEW=/tmp/funnel.html FUNNEL_CSS=/tmp/crs.css pnpm --filter @revio/reservation test
 */

const D = (s: string) => new Date(s);
const names = new Map([["deluxe", "Deluxe Double"], ["standard", "Standard Twin"], ["suite", "Sea-view Suite"]]);

function h(o: Partial<FunnelHold>): FunnelHold {
  return {
    status: "converted", sessionId: null, roomTypeId: "deluxe",
    createdAt: D("2026-09-01T10:00:00Z"), checkIn: "2026-09-20", checkOut: "2026-09-23", ...o,
  };
}

const BUSY: FunnelHold[] = [
  h({ sessionId: "1", status: "converted", roomTypeId: "deluxe", checkIn: "2026-09-20", checkOut: "2026-09-22" }),
  h({ sessionId: "2", status: "converted", roomTypeId: "deluxe", checkIn: "2026-09-18", checkOut: "2026-09-21" }),
  h({ sessionId: "3", status: "converted", roomTypeId: "standard", checkIn: "2026-09-25", checkOut: "2026-09-27" }),
  h({ sessionId: "4", status: "released", roomTypeId: "suite", checkIn: "2026-09-20", checkOut: "2026-09-28" }),
  h({ sessionId: "5", status: "released", roomTypeId: "suite", checkIn: "2026-09-22", checkOut: "2026-09-30" }),
  h({ sessionId: "6", status: "expired", roomTypeId: "standard", checkIn: "2026-09-20", checkOut: "2026-09-27" }),
  h({ sessionId: "7", status: "expired", roomTypeId: "deluxe", checkIn: "2026-09-21", checkOut: "2026-09-29" }),
  h({ sessionId: "8", status: "active", roomTypeId: "deluxe" }),
  // One guest comparing two rooms and booking one — must read as a single session.
  h({ sessionId: "9", status: "expired", roomTypeId: "suite", createdAt: D("2026-09-02T09:00:00Z") }),
  h({ sessionId: "9", status: "converted", roomTypeId: "standard", createdAt: D("2026-09-02T09:05:00Z"), checkIn: "2026-09-20", checkOut: "2026-09-22" }),
];

describe("FunnelPanel", () => {
  const html = renderToStaticMarkup(
    <FunnelPanel sessions={funnelSessions(BUSY)} roomTypeName={names} inferred />,
  );

  it("leads with the rate, and 9 sessions rather than 10 holds", () => {
    // 4 booked of 8 decided = 50%. Counted by hold it would be 4 of 9 = 44%, because the guest who
    // compared two rooms would have left a phantom abandonment behind.
    expect(html).toContain("50%");
    expect(html).toContain(">9<"); // sessions opened
  });

  it("keeps 'left the form' and 'ran out of time' apart", () => {
    expect(html).toContain("Left the form");
    expect(html).toContain("Ran out of time");
  });

  it("says who is still deciding without counting them as a loss", () => {
    expect(html).toContain("filling in the form right now");
  });

  it("names rooms, not ids", () => {
    expect(html).toContain("Sea-view Suite");
    expect(html).not.toContain("suite<");
  });

  it("admits when part of the range is inferred rather than measured", () => {
    expect(html).toContain("inferred rather than measured");
  });

  it("invites the first guest instead of showing a wall of zeroes", () => {
    const empty = renderToStaticMarkup(
      <FunnelPanel sessions={funnelSessions([])} roomTypeName={names} inferred={false} />,
    );
    expect(empty).toContain("Nobody has opened a booking form yet");
    expect(empty).not.toContain("0%");
  });

  it("writes a preview when asked", () => {
    const out = process.env.FUNNEL_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.FUNNEL_CSS!, "utf8");
    const empty = renderToStaticMarkup(
      <FunnelPanel sessions={funnelSessions([])} roomTypeName={names} inferred={false} />,
    );
    const card = (t: string, s: string, inner: string) =>
      `<div class="rounded-xl border border-surface-border bg-white"><div class="border-b border-surface-border px-4 py-3"><h3 class="text-[13px] font-bold text-ink-900">${t}</h3><p class="mt-0.5 text-[12px] text-ink-500">${s}</p></div>${inner}</div>`;
    writeFileSync(
      out,
      `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
        `<div class="space-y-6 bg-surface-page p-6" style="max-width:920px">` +
        card("How your booking page is doing", "The last 30 days — every guest who opened a booking form, and how it ended.", html) +
        card("Empty state", "A hotel that has just switched the engine on", empty) +
        `</div></body>`,
    );
  });
});
