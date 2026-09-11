import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { Donut } from "./Donut";
import { DailyBars } from "./DailyBars";

/**
 * The two charts on the analytics screen.
 *
 * A chart is the one thing on a dashboard nobody checks the arithmetic of — it looks plausible
 * whatever it draws — so the arithmetic is pinned here.
 *
 *     ANALYTICS_PREVIEW=/tmp/charts.html ANALYTICS_CSS=/tmp/op.css pnpm --filter @revio/operator test
 */

const SLICES = [
  { label: "RevioLink", value: 60, colour: "#0e7490" },
  { label: "RevioCRS", value: 30, colour: "#4f46e5" },
  { label: "RevioPMS", value: 10, colour: "#047857" },
];

const donut = (slices = SLICES) => renderToStaticMarkup(React.createElement(Donut, { slices }));

describe("the donut", () => {
  it("gives each slice its share of the circumference", () => {
    // size 132, thickness 18 → r = 57 → circumference = 358.14…
    const html = donut();
    const c = 2 * Math.PI * 57;
    // 60% of the ring for the first slice.
    expect(html).toContain(`stroke-dasharray="${(0.6 * c).toString()}`.slice(0, 24));
  });

  it("starts each slice where the previous one ended", () => {
    /*
     * The bug a donut has exactly once: every segment drawn from twelve o'clock, stacked on top of
     * each other, which looks like a chart and is one slice wide.
     */
    const offsets = [...donut().matchAll(/stroke-dashoffset="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    // `toBeCloseTo`, not `toBe(-0)`: React renders the first offset as "0" and Object.is says +0
    // and -0 are different numbers. The claim worth making is that it starts at the top.
    expect(offsets[0]).toBeCloseTo(0);
    expect(offsets[1]).toBeLessThan(0);
    expect(offsets[2]).toBeLessThan(offsets[1]!);
  });

  it("prints the percentages as well as drawing them", () => {
    // The ring is for the shape; these are the numbers somebody quotes on a call.
    const html = donut();
    expect(html).toContain("60%");
    expect(html).toContain("30%");
    expect(html).toContain("10%");
  });

  it("rotates so the first slice starts at twelve o'clock", () => {
    // Everybody reads a dial clockwise from the top. SVG angles start at three o'clock.
    expect(donut()).toContain("rotate(-90 66 66)");
  });

  it("says so instead of drawing an empty ring when there is nothing", () => {
    expect(donut([])).toMatch(/Nothing recorded in this window yet/);
    expect(donut([{ label: "x", value: 0, colour: "#000" }])).toMatch(/Nothing recorded/);
  });

  it("describes itself to a screen reader in shares, not in pixels", () => {
    expect(donut()).toContain('aria-label="RevioLink: 60%, RevioCRS: 30%, RevioPMS: 10%"');
  });
});

const days = (people: number[]) =>
  people.map((p, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, "0")}`,
    people: p,
    views: p * 4,
  }));

describe("the daily bars", () => {
  it("scales every column against the busiest day", () => {
    const html = renderToStaticMarkup(React.createElement(DailyBars, { series: days([5, 10]) }));
    expect(html).toContain("height:50%");
    expect(html).toContain("height:100%");
    expect(html).toContain("peak 10");
  });

  it("draws a day with nobody as a visible gap, not as nothing", () => {
    /*
     * A zero drawn as zero height leaves the axis starting wherever the data does, and a quiet
     * fortnight stops looking like a quiet fortnight. The whole point of this chart is spotting a
     * hotel that stopped.
     */
    const html = renderToStaticMarkup(React.createElement(DailyBars, { series: days([0, 8]) }));
    expect(html).toContain("height:2%");
    expect(html).toContain("#e7eaef");
  });

  it("marks weekends differently, because a quiet Saturday is not a quiet Tuesday", () => {
    // 2026-09-05 is a Saturday, 2026-09-01 a Tuesday.
    const html = renderToStaticMarkup(React.createElement(DailyBars, { series: days([4, 4, 4, 4, 4]) }));
    expect(html).toContain("#9aa3b1"); // weekend grey
    expect(html).toContain("#1d4ea0"); // weekday brand
  });

  it("never divides by zero on a month when nobody came in", () => {
    const html = renderToStaticMarkup(React.createElement(DailyBars, { series: days([0, 0, 0]) }));
    expect(html).not.toContain("NaN");
    expect(html).toContain("peak 1");
  });
});

it("writes a preview when asked", () => {
  const file = process.env.ANALYTICS_PREVIEW;
  if (!file) return;
  const css = process.env.ANALYTICS_CSS ?? "";
  const real = [9, 11, 12, 8, 3, 2, 10, 12, 13, 11, 9, 4, 2, 11, 12, 12, 10, 11, 3, 2, 8, 6, 5, 4, 4, 1, 2, 3, 2, 1];
  const body =
    `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:0 0 10px">Was anybody there — thirty days, tapering off</p>` +
    `<div style="background:#fff;padding:20px;border-radius:12px;border:1px solid #dde4ee">${renderToStaticMarkup(React.createElement(DailyBars, { series: days(real) }))}</div>` +
    `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 10px">Where the attention goes</p>` +
    `<div style="background:#fff;padding:20px;border-radius:12px;border:1px solid #dde4ee;max-width:460px">${renderToStaticMarkup(
      React.createElement(Donut, { slices: SLICES, centreValue: "1,420", centreLabel: "screens" }),
    )}</div>`;
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>` +
      `<body style="margin:0;padding:24px;background:#f7f8fa;max-width:900px;font-family:system-ui">${body}</body></html>`,
  );
  expect(body.length).toBeGreaterThan(0);
});
