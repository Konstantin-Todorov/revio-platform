import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { pairKey, ROOM_ONLY, type SelectableRoom } from "@revio/core";
import { PlanTree } from "@revio/ui/plan-tree";

const plan = (id: string, name: string, over = {}) =>
  ({ id, name, active: true, priceLogic: "manual", ...over });

const ROOMS: SelectableRoom[] = [
  { id: "r1", name: "Apartment, 1 Bedroom", code: "1BR", plans: [
    plan("flex", "BB Flex", { code: "BB48" }),
    plan("nr", "BB Non-Refundable", { code: "BBNR" }),
    plan("std", "Standard Rate", { code: "BAR", active: false }),
    plan("mob", "BB Mobile", { priceLogic: "derived", parentName: "BB Flex" }),
  ] },
  { id: "r2", name: "Apartment, 2 Bedrooms", code: "APA2", plans: [plan("flex", "BB Flex"), plan("nr", "BB Non-Refundable")] },
  { id: "r3", name: "Apartment, 3 Bedrooms", code: "APA", plans: [plan("flex", "BB Flex")] },
];

const render = (selected: Set<string>) =>
  renderToStaticMarkup(<PlanTree rooms={ROOMS} selected={selected} onChange={() => {}} />)
    .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/g, "/");

describe("PlanTree", () => {
  const partial = render(new Set([pairKey("r1", "flex"), pairKey("r2", "nr")]));

  it("⚠️ the PLAN's name is the label, never a list of room types", () => {
    // BUG-022: both checkboxes read "Apartment, 3 Bedrooms, Apartment, 2 …" with the plan name
    // truncated off the end, so the screen where you choose between them showed them identically.
    expect(partial).toContain("BB Flex");
    expect(partial).toContain("BB Non-Refundable");
  });

  it("puts every plan under its own room", () => {
    expect(partial).toContain("Apartment, 1 Bedroom");
    expect(partial).toContain("Apartment, 2 Bedrooms");
    expect(partial).toContain("Apartment, 3 Bedrooms");
  });

  it("⚠️ shows derived and inactive plans rather than hiding them", () => {
    expect(partial).toContain("BB Mobile");
    expect(partial).toMatch(/follows BB Flex/);
    expect(partial).toContain("Standard Rate");
    expect(partial).toContain("inactive");
  });

  it("marks a partly-selected room as mixed, not checked", () => {
    expect(partial).toContain('aria-checked="mixed"');
  });

  it("⚠️ counts in words a person can check against what they meant", () => {
    expect(partial).toContain("Selected 2 rate plans across 2 room types");
  });

  it("says nothing is selected rather than showing an empty panel", () => {
    expect(render(new Set())).toContain("Nothing selected");
  });

  it("⚠️ a room with nothing tickable is still offered, and says what it can take", () => {
    /*
     * Allocation and every restriction are written per ROOM TYPE, so a room type created five
     * minutes ago with no plan linked yet is exactly the room whose allocation somebody needs to
     * set. A tree that only offered plans would have silently removed that ability — the two-list
     * selector it replaces could express it (tick the room, tick no plan).
     */
    const bare: SelectableRoom[] = [{ id: "rb", name: "Penthouse", code: "PH", plans: [] }];
    const markup = renderToStaticMarkup(
      <PlanTree rooms={bare} selected={new Set([pairKey("rb", ROOM_ONLY)])} onChange={() => {}} />,
    ).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
    expect(markup).toContain("Penthouse");
    expect(markup).toContain("allocation & restrictions only");
    // Never "0 rate plans" — the same class of lie as "0 problems" from a check that ran on nothing.
    expect(markup).toContain("Selected 1 room type with no editable plans");
    expect(markup).not.toContain('aria-checked="false"');
  });

  it("writes a preview when asked", () => {
    const out = process.env.TREE_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.TREE_CSS!, "utf8");
    writeFileSync(out, `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
      `<div class="bg-surface-page p-6" style="max-width:560px">` +
      `<span class="mb-1.5 block text-[12px] font-semibold text-ink-700">Which rate plans would you like to apply these changes to?</span>` +
      renderToStaticMarkup(
        <PlanTree
          rooms={[...ROOMS, { id: "rb", name: "Penthouse", code: "PH", plans: [] }]}
          selected={new Set([pairKey("r1", "flex"), pairKey("r2", "nr"), pairKey("rb", ROOM_ONLY)])}
          onChange={() => {}}
        />,
      ) +
      `<span class="mt-1.5 block text-[11px] leading-snug text-ink-400">A price lands on the plans you tick. ` +
      `Allocation and restrictions are written per room type, so they apply to every room with something ` +
      `ticked under it &mdash; derived plans included.</span>` +
      `</div></body>`);
  });
});
