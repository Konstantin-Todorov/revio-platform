import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { readTrial, type ProductKey } from "@revio/core";

vi.mock("next/link", () => ({
  default: ({ children, ...p }: React.ComponentProps<"a">) => React.createElement("a", p, children),
}));

import { TrialsPanel } from "@/components/analytics/TrialsPanel";
import type { TrialRow } from "@/lib/trial-reading-data";

const NOW = new Date("2026-09-20T00:00:00Z");
// NOT named `use`: ESLint treats every `use*` function as a React hook, so a test fixture called
// `use()` fails `react-hooks/rules-of-hooks` at the top level — and it fails in `next build` rather
// than in vitest, which is a slow way to find out.
const touched = (product: ProductKey, activeDays: number, people = 1) =>
  ({ product, activeDays, people, views: activeDays * 12 });

function row(
  tenantName: string,
  over: Partial<Parameters<typeof readTrial>[0]>,
  extra: Partial<TrialRow> = {},
): TrialRow {
  const startedAt = new Date("2026-09-01T00:00:00Z");
  const endsAt = new Date("2026-10-01T00:00:00Z");
  return {
    tenantId: tenantName.toLowerCase().replace(/\W+/g, "-"),
    tenantName,
    isDemo: false,
    product: "cm",
    startedAt,
    endsAt,
    reading: readTrial({
      startedAt, endsAt, endedAt: null, outcome: null, keepRequestedAt: null,
      usage: [], lastSeenDaysAgo: null, now: NOW, ...over,
    }),
    ...extra,
  };
}

const ROWS: TrialRow[] = [
  row("Hotel Cabacum Beach", { keepRequestedAt: new Date(), usage: [touched("pms", 12, 4)], lastSeenDaysAgo: 0 }),
  row("Black Sea Resort", { usage: [touched("crs", 3)], lastSeenDaysAgo: 8 }),
  row("Hotel Sofia Group", { usage: [touched("crs", 11, 3)], lastSeenDaysAgo: 0 }, { isDemo: true }),
  row("Guest House Rila", {}),
  row("Hotel Vitosha", { endedAt: new Date("2026-09-18T00:00:00Z"), outcome: "expired", usage: [touched("cm", 9, 2)], lastSeenDaysAgo: 2 }),
];

describe("TrialsPanel", () => {
  const html = renderToStaticMarkup(<TrialsPanel rows={ROWS} needAttention={3} />).replace(/&#x27;/g, "'");

  it("⚠️ names the product they USED, not the one they signed up for", () => {
    // Every row's `product` is "cm"; the panel must lead with what the usage says instead.
    expect(html).toContain("RevioPMS");
    expect(html).toContain("RevioCRS");
  });

  it("says what to do, in their own numbers", () => {
    expect(html).toMatch(/Reply\./);
    expect(html).toMatch(/nothing for 8/);
    expect(html).toMatch(/rescue, not a sale/i);
  });

  it("counts down in days left, because that is the decision", () => {
    expect(html).toMatch(/11 days left/);
  });

  it("⚠️ does NOT count down a trial that has already ended", () => {
    // "ended · was used" beside "11 days left" is a contradiction on one line, and it shipped to a
    // screenshot before anybody noticed. A trial ended early still has a future end date.
    const ended = ROWS.find((r) => r.reading.verdict === "ended_engaged")!;
    expect(ended.reading.finished).toBe(true);
    const only = renderToStaticMarkup(<TrialsPanel rows={[ended]} needAttention={0} />);
    expect(only).not.toMatch(/days left/);
    expect(only).toMatch(/ended · was used/);
  });

  it("badges a demo trial rather than hiding it", () => {
    // Hiding them would mean nobody ever sees this screen work before the first real signup.
    expect(html).toContain("Hotel Sofia Group");
    expect(html).toContain("demo");
  });

  it("leads with how many need something today", () => {
    expect(html).toMatch(/3 trials need something today/);
  });

  it("invites the first signup rather than showing an empty table", () => {
    const empty = renderToStaticMarkup(<TrialsPanel rows={[]} needAttention={0} />);
    expect(empty).toContain("No trials yet");
    expect(empty).toMatch(/all three products for 30 days/);
  });

  it("writes a preview when asked", () => {
    const out = process.env.TRIALS_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.TRIALS_CSS!, "utf8");
    writeFileSync(
      out,
      `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
        `<div class="bg-surface-page p-6"><div class="mx-auto max-w-3xl rounded-xl border border-surface-border bg-white">` +
        `<div class="border-b border-surface-border px-4 py-3"><h3 class="text-[13px] font-bold text-ink-900">Trials — what they did, and what to sell them</h3>` +
        `<p class="mt-0.5 text-[12px] text-ink-500">Every hotel gets all three products, so what they actually opened is the answer to what they will pay for</p></div>` +
        renderToStaticMarkup(<TrialsPanel rows={ROWS} needAttention={3} />) +
        `</div></div></body>`,
    );
  });
});
