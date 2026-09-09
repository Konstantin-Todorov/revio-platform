import { describe, it, expect } from "vitest";
import { OPERATOR_AREAS, areaForPath, tabsForPath } from "./navigation";

/**
 * The navigation contract.
 *
 * Two attempts at this were rejected by the founder, so the properties that make it *tidy* rather
 * than merely different are asserted here instead of being left to a reviewer's eye.
 */

const EVERY_ROUTE = [
  "/overview", "/clients", "/leads", "/support", "/plans", "/billing",
  "/health", "/errors", "/auth-log", "/integrations", "/connectivity",
  "/analytics", "/platform-history", "/settings",
];

describe("the shape of the menu", () => {
  it("shows seven areas — few enough to read, not fourteen to search", () => {
    expect(OPERATOR_AREAS).toHaveLength(7);
  });

  it("still reaches every screen the flat menu reached — nothing was lost in the tidy-up", () => {
    // The failure this catches is the quiet one: a reorganisation that drops a screen off the menu
    // leaves it live, linked from nowhere, and discovered months later.
    const reachable = OPERATOR_AREAS.flatMap((a) => a.screens.map((s) => s.href)).sort();
    expect(reachable).toEqual([...EVERY_ROUTE].sort());
  });

  it("lists no route twice, so nothing is in two places at once", () => {
    const hrefs = OPERATOR_AREAS.flatMap((a) => a.screens.map((s) => s.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("opens each area at its first screen, and that choice is meaningful", () => {
    // The first screen is what the area means, so these two orderings are load-bearing rather than
    // incidental: the price list is the decision and invoices are its consequence; you ask whether
    // the platform is healthy before you read the list of faults.
    const first = (key: string) => OPERATOR_AREAS.find((a) => a.key === key)!.screens[0]!.href;
    expect(first("revenue")).toBe("/plans");
    expect(first("operations")).toBe("/health");
    expect(first("clients")).toBe("/clients");
  });
});

describe("areaForPath", () => {
  it("highlights the right area for every screen", () => {
    for (const area of OPERATOR_AREAS) {
      for (const screen of area.screens) {
        expect(areaForPath(screen.href)?.key).toBe(area.key);
      }
    }
  });

  it("keeps the area highlighted when you drill into a detail page", () => {
    // Otherwise the menu goes blank exactly when you are deepest in, and you cannot tell where
    // you are or how to get back out.
    expect(areaForPath("/clients/abc123")?.key).toBe("clients");
    expect(areaForPath("/support/case-9")?.key).toBe("support");
    expect(areaForPath("/integrations/stripe")?.key).toBe("operations");
    expect(areaForPath("/settings/company")?.key).toBe("settings");
  });

  it("highlights nothing for a route that is not in the menu", () => {
    // Search and a rendered invoice are reached from the topbar and from links. Lighting up an
    // unrelated area while somebody reads an invoice is worse than lighting up none.
    expect(areaForPath("/search")).toBeNull();
    expect(areaForPath("/invoice/inv_1")).toBeNull();
  });

  it("does not let one screen swallow another whose path merely starts the same way", () => {
    // `/auth-log` must not be claimed by anything, and a future `/clients-archive` must not be
    // claimed by `/clients` — prefix matching is on path SEGMENTS, not characters.
    expect(areaForPath("/auth-log")?.key).toBe("operations");
    expect(areaForPath("/clients-archive")).toBeNull();
  });
});

describe("tabsForPath", () => {
  it("draws tabs for an area with several screens", () => {
    expect(tabsForPath("/plans").map((t) => t.href)).toEqual(["/plans", "/billing"]);
    expect(tabsForPath("/health")).toHaveLength(5);
  });

  it("draws NO tabs for an area with a single screen", () => {
    // One tab is furniture. It says nothing and takes a row of the page to say it.
    expect(tabsForPath("/overview")).toEqual([]);
    expect(tabsForPath("/support")).toEqual([]);
    expect(tabsForPath("/settings")).toEqual([]);
  });

  it("draws NO tabs on a detail page", () => {
    /*
     * `/clients/[id]` already has its own tab row. Stacking a second one above it is the "one long
     * amateur list" problem again, one level down — and on `/integrations/stripe` the page carries
     * its own back link instead.
     */
    expect(tabsForPath("/clients/abc123")).toEqual([]);
    expect(tabsForPath("/integrations/stripe")).toEqual([]);
    expect(tabsForPath("/settings/company")).toEqual([]);
  });
});
