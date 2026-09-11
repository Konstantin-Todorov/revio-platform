import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { trialBanner, type TrialBannerFacts } from "@revio/core";
import { TrialStrip } from "@revio/ui/trial-banner";

/**
 * What the strip actually looks like, in all four states a hotel can be in.
 *
 * `docs/UI-STANDARD.md` rule 4 — look at the rendered page. This one is rendered inside three
 * products and read on arrival at every screen, which makes "it passes its tests" an especially poor
 * substitute for looking. It lives in RevioPMS, one of its three consumers, because this app already
 * has the JSX test harness — the same reason the operator's shell preview lives in the operator:
 *
 *     TRIAL_STRIP_PREVIEW=/tmp/strip.html TRIAL_STRIP_CSS=/tmp/pms.css pnpm --filter @revio/pms test
 */

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const START = new Date("2026-09-01T09:00:00Z");
const END = new Date("2026-10-01T09:00:00Z");
const facts = (o: Partial<TrialBannerFacts> = {}): TrialBannerFacts => ({
  product: "pms", startedAt: START, endsAt: END, keepRequested: false, ...o,
});
const noop = async () => {};
const strip = (now: string, o: Partial<TrialBannerFacts> = {}, withAction = true) =>
  renderToStaticMarkup(
    React.createElement(TrialStrip, {
      banner: trialBanner(facts(o), new Date(now), fmt),
      ...(withAction ? { keepAction: noop } : {}),
    }),
  );

describe("what it shows", () => {
  it("leads with the count and names the product", () => {
    const html = strip("2026-09-08T09:00:00Z");
    expect(html).toContain("23 days left of your free RevioPMS trial");
    expect(html).toContain("Free trial");
  });

  it("draws the bar to the share of the trial already used", () => {
    // The count said without words — the half of rule 2 that does the work before anything is read.
    expect(strip("2026-09-16T09:00:00Z")).toContain("width:50%");
    expect(strip("2026-09-01T09:00:00Z")).toContain("width:0%");
  });

  it("offers the way out, and stops offering once it is taken", () => {
    expect(strip("2026-09-08T09:00:00Z")).toContain("Keep RevioPMS");
    const asked = strip("2026-09-08T09:00:00Z", { keepRequested: true });
    expect(asked).not.toContain("Keep RevioPMS");
    expect(asked).toMatch(/asked to keep/i);
  });

  it("shows the countdown to somebody who may not act on it, without a button they cannot use", () => {
    /*
     * A receptionist should still know why the product stops next Tuesday. Offering them a button
     * that refuses them would be worse than offering none — see `isTrialDecider`.
     */
    const html = strip("2026-09-08T09:00:00Z", {}, false);
    expect(html).toContain("23 days left");
    expect(html).not.toContain("<button");
  });
});

describe("how it escalates", () => {
  it("is quiet early, amber at a week, red on the last day", () => {
    expect(strip("2026-09-08T09:00:00Z")).toContain("bg-surface");
    expect(strip("2026-09-24T09:00:00Z")).toContain("bg-warning-50");
    expect(strip("2026-09-30T09:00:00Z")).toContain("bg-danger-50");
  });

  it("never renders a class Tailwind would not generate", () => {
    // `bg-brand-050` shipped once and rendered with no background at all, silently — the tokens use
    // "050" as a key while every app's Tailwind config registers it as "50".
    for (const now of ["2026-09-08", "2026-09-24", "2026-09-30"]) {
      expect(strip(`${now}T09:00:00Z`)).not.toMatch(/-0\d0\b/);
    }
  });
});

it("writes a preview when asked", () => {
  const file = process.env.TRIAL_STRIP_PREVIEW;
  if (!file) return;
  const css = process.env.TRIAL_STRIP_CSS ?? "";
  const views: [string, string, Partial<TrialBannerFacts>][] = [
    ["Day 8 of 30 — calm", "2026-09-08T09:00:00Z", {}],
    ["7 days left — warning", "2026-09-24T09:00:00Z", {}],
    ["Last day — urgent", "2026-09-30T09:00:00Z", {}],
    ["They asked to keep it", "2026-09-20T09:00:00Z", { keepRequested: true }],
    ["RevioLink, seen by a receptionist (no button)", "2026-09-12T09:00:00Z", { product: "cm" }],
  ];
  const body = views
    .map(([label, now, o], i) =>
      `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 8px">${label}</p>
       <div style="background:#f7f8fa;padding:16px;border-radius:12px">${strip(now, o, i !== 4)}</div>`,
    )
    .join("");
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<link rel="stylesheet" href="${css}">` +
      `</head><body style="margin:0;padding:24px;background:#fff;max-width:1100px">${body}</body></html>`,
  );
  expect(body.length).toBeGreaterThan(0);
});
