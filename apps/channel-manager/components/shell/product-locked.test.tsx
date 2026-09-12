import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { productAccessState } from "@revio/core";
import { ProductLocked } from "@revio/ui/product-locked";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const href = (k: string) => `https://${k}.reviosoft.app`;
const ENDED = new Date("2026-09-01T00:00:00Z");

/**
 * Rendered, then un-escaped.
 *
 * React writes `'` as `&#x27;`, so asserting on the raw markup means every apostrophe in the copy
 * has to be spelled as an entity in the test — which is how a test ends up passing because it was
 * written around the escaping rather than because the words are right.
 */
function screen(state: Parameters<typeof ProductLocked>[0]["state"]) {
  const html = renderToStaticMarkup(
    <ProductLocked state={state} hotelName="Hotel Cabacum Beach" fmtDate={fmt} hrefFor={href} />,
  );
  return html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const endedState = productAccessState({
  product: "cm",
  trials: [{ product: "cm", endedAt: ENDED, outcome: "expired", keepRequestedAt: null }],
  entitlements: { cm: false, crs: true, pms: true },
});

describe("ProductLocked", () => {
  it("⚠️ never tells a hotel that ran a trial it 'hasn't subscribed'", () => {
    expect(screen(endedState)).not.toMatch(/hasn.t subscribed/i);
  });

  it("says what happened, when, and that nothing was lost", () => {
    const html = screen(endedState);
    expect(html).toMatch(/trial has ended/i);
    expect(html).toContain("1 September 2026");
    expect(html).toMatch(/Nothing has been deleted/i);
  });

  it("⚠️ is never a dead end — the products they still have are on it", () => {
    const html = screen(endedState);
    expect(html).toContain("RevioCRS");
    expect(html).toContain("RevioPMS");
    expect(html).toContain("https://crs.reviosoft.app");
    // And not the one they are locked out of.
    expect(html).not.toContain("https://cm.reviosoft.app");
  });

  it("says we heard them once they have asked", () => {
    const asked = productAccessState({
      product: "cm",
      trials: [{ product: "cm", endedAt: ENDED, outcome: "expired", keepRequestedAt: new Date() }],
      entitlements: { cm: false, crs: true, pms: false },
    });
    expect(screen(asked)).toMatch(/we.ll be in touch/i);
  });

  it("makes a real offer to a hotel that never had it", () => {
    const never = productAccessState({ product: "pms", trials: [], entitlements: { cm: true, crs: false, pms: false } });
    const html = screen(never);
    expect(html).toMatch(/doesn.t have RevioPMS yet/i);
    expect(html).toMatch(/30 days/);
  });

  it("⚠️ the offer is reachable — 'try it free' has something to press", () => {
    // An offer with no button is a worse dead end than no offer, and this screen exists to remove
    // dead ends. The flow lives inside (protected), so it is launched from a product they CAN open.
    const never = productAccessState({ product: "pms", trials: [], entitlements: { cm: true, crs: false, pms: false } });
    const html = screen(never);
    expect(html).toContain("https://cm.reviosoft.app/start-trial/pms");
    expect(html).toMatch(/Start your free trial/);
  });

  it("does not dangle a trial offer when there is nowhere to launch it from", () => {
    // Locked out of everything: no product can host the flow, so the honest action is a human.
    const nowhere = productAccessState({ product: "pms", trials: [], entitlements: { cm: false, crs: false, pms: false } });
    const html = screen(nowhere);
    expect(html).not.toMatch(/Start your free trial/);
    expect(html).toContain("support@reviosoft.app");
  });

  it("always offers a human", () => {
    expect(screen(endedState)).toContain("support@reviosoft.app");
  });

  it("writes a preview when asked", () => {
    const out = process.env.LOCKED_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.LOCKED_CSS!, "utf8");
    const never = productAccessState({ product: "pms", trials: [], entitlements: { cm: true, crs: true, pms: false } });
    writeFileSync(
      out,
      `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
        `<div style="border-bottom:2px solid #ddd">${screen(endedState)}</div>` +
        `<div>${screen(never)}</div></body>`,
    );
  });
});
