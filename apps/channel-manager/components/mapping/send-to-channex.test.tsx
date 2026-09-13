import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";

vi.mock("@/lib/actions-connect", () => ({ sendProductToChannex: vi.fn() }));
import { SendToChannex } from "./SendToChannex";

const PRODUCTS = [
  { id: "rt-1", name: "Deluxe Suite", kind: "roomType" as const },
  { id: "rp-1", name: "BB Non-Refundable", kind: "ratePlan" as const },
];

const render = (products: typeof PRODUCTS) =>
  renderToStaticMarkup(<SendToChannex products={products} />)
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("SendToChannex", () => {
  const markup = render(PRODUCTS);

  it("⚠️ names each product on its own button — never one 'fix everything'", () => {
    // This writes to a hotel's live distribution. A bulk button is the shape that hides what it did.
    expect(markup).toContain("Send Deluxe Suite");
    expect(markup).toContain("Send BB Non-Refundable");
  });

  it("says WHY it happened, which is the half that stops it happening again", () => {
    expect(markup).toMatch(/added after this channel was connected/i);
    expect(markup).toMatch(/only sends what exists at the time/i);
  });

  it("states the consequence in the hotel's terms, not ours", () => {
    // "unmapped product" is our word. "No OTA can see them" is what it costs them.
    expect(markup).toMatch(/No OTA can see them/i);
  });

  it("counts correctly for one", () => {
    expect(render([PRODUCTS[0]!])).toContain("One product has");
  });

  it("renders nothing at all when there is no gap", () => {
    expect(render([])).toBe("");
  });

  it("writes a preview when asked", () => {
    const out = process.env.CATCHUP_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.CATCHUP_CSS!, "utf8");
    writeFileSync(out, `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
      `<div class="bg-surface-page p-6" style="max-width:720px">${render(PRODUCTS)}</div></body>`);
  });
});
