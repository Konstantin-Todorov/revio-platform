import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));

import { activeSegment, reservationSegments, segmentHref } from "@/lib/segments";

/**
 * The segment strip, rendered.
 *
 *     SEGMENTS_PREVIEW=/tmp/segments.html SEGMENTS_CSS=/tmp/crs.css pnpm --filter @revio/reservation test
 */

const TODAY = "2026-09-12";

function Strip({ counts, sp }: { counts: Record<string, number>; sp: Record<string, string> }) {
  const segments = reservationSegments(TODAY);
  const current = activeSegment(sp, TODAY);
  return (
    <nav aria-label="Reservation segments" className="flex flex-wrap gap-1.5">
      {segments.map((seg) => {
        const active = current === seg.key;
        const n = counts[seg.key] ?? 0;
        return (
          <a
            key={seg.key}
            href={segmentHref(seg)}
            aria-current={active ? "page" : undefined}
            {...(seg.hint ? { title: seg.hint } : {})}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active
                ? "border-brand-600/30 bg-brand-50 text-brand-800"
                : "border-surface-border bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {seg.label}
            <span
              className={`tnum rounded px-1.5 py-0.5 text-[11px] font-bold ${
                active ? "bg-brand-600/15 text-brand-800" : n === 0 ? "bg-surface-sunken text-ink-400" : "bg-surface-sunken text-ink-700"
              }`}
            >
              {n}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

const COUNTS = { all: 76, arriving: 4, inhouse: 12, departing: 3, cancelled: 0 };
const html = (sp: Record<string, string> = {}) =>
  renderToStaticMarkup(<Strip counts={COUNTS} sp={sp} />);

describe("the strip", () => {
  it("shows every segment with its count", () => {
    const out = html();
    for (const label of ["All", "Arriving today", "In house", "Departing today", "Cancelled"]) {
      expect(out).toContain(label);
    }
    expect(out).toContain(">76<");
    expect(out).toContain(">12<");
  });

  it("says zero rather than hiding it", () => {
    // "Cancelled 0" is a fact somebody acts on; a missing number reads as "not loaded".
    expect(html()).toContain(">0<");
  });

  it("marks the active tab for a screen reader, not only in colour", () => {
    const out = html({ dateType: "stay", from: TODAY, to: TODAY });
    expect(out).toMatch(/aria-current="page"[^>]*>In house|In house/);
    expect((out.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });

  it("marks nothing when the filters match no segment", () => {
    expect(html({ dateType: "created", from: TODAY, to: TODAY })).not.toContain('aria-current="page"');
  });
});

it("writes a preview when asked", () => {
  const file = process.env.SEGMENTS_PREVIEW;
  if (!file) return;
  const css = process.env.SEGMENTS_CSS ?? "";
  const views: [string, string][] = [
    ["Nothing filtered — All is lit", html()],
    ["In house selected", html({ dateType: "stay", from: TODAY, to: TODAY })],
    ["A hand-typed range — nothing lit", html({ dateType: "check_in", from: "2026-08-01", to: "2026-08-31" })],
  ];
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>` +
      `<body style="margin:0;padding:24px;background:#f7f8fa;font-family:system-ui">` +
      views.map(([l, h]) =>
        `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:0 0 10px">${l}</p>${h}<div style="height:28px"></div>`,
      ).join("") +
      `</body></html>`,
  );
  expect(views.length).toBe(3);
});
