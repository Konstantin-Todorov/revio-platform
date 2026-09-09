import { describe, it, expect } from "vitest";
import { OPERATOR_AREAS, areaForPath, sectionsForPath, activeSection } from "./navigation";

/**
 * The navigation contract.
 *
 * Two attempts at this were rejected by the founder, so the properties that make it *tidy* rather
 * than merely different are asserted here instead of being left to a reviewer's eye.
 */

const EVERY_ROUTE = [
  "/overview", "/clients", "/leads", "/support", "/plans", "/billing",
  "/health", "/errors", "/auth-log", "/integrations", "/connectivity",
  "/analytics", "/platform-history", "/settings/account",
];

describe("the shape of the menu", () => {
  it("shows seven areas — few enough to read, not fourteen to search", () => {
    expect(OPERATOR_AREAS).toHaveLength(7);
  });

  it("still reaches every screen the flat menu reached — nothing was lost in the tidy-up", () => {
    // The failure this catches is the quiet one: a reorganisation that drops a screen off the menu
    // leaves it live, linked from nowhere, and discovered months later.
    const reachable = new Set(OPERATOR_AREAS.flatMap((a) => [a.href, ...a.sections.map((s) => s.href)]));
    for (const route of EVERY_ROUTE) expect([...reachable], `${route} is reachable`).toContain(route);
  });

  it("lists no route twice, so nothing is in two places at once", () => {
    const hrefs = OPERATOR_AREAS.flatMap((a) => a.sections.map((s) => s.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("opens an area with sections at its first section", () => {
    // The rail icon is not a page — it is a way in. Landing anywhere but the first section would
    // make the panel's order look arbitrary.
    for (const area of OPERATOR_AREAS) {
      if (area.sections.length >= 2) expect(area.href, area.key).toBe(area.sections[0]!.href);
    }
  });

  it("opens each area at its first screen, and that choice is meaningful", () => {
    // The first screen is what the area means, so these orderings are load-bearing rather than
    // incidental: the price list is the decision and invoices are its consequence; you ask whether
    // the platform is healthy before you read the list of faults.
    const first = (key: string) => OPERATOR_AREAS.find((a) => a.key === key)!.href;
    expect(first("revenue")).toBe("/plans");
    expect(first("operations")).toBe("/health");
    expect(first("clients")).toBe("/clients");
    expect(first("settings")).toBe("/settings/account");
  });
});

describe("areaForPath", () => {
  it("highlights the right area for every screen", () => {
    for (const area of OPERATOR_AREAS) {
      expect(areaForPath(area.href)?.key, area.key).toBe(area.key);
      for (const section of area.sections) {
        expect(areaForPath(section.href)?.key, section.href).toBe(area.key);
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
    expect(areaForPath("/settings")?.key).toBe("settings");
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

describe("sectionsForPath — the vertical panel", () => {
  it("lists an area's sections down the side", () => {
    expect(sectionsForPath("/plans").map((s) => s.href)).toEqual(["/plans", "/billing"]);
    expect(sectionsForPath("/health")).toHaveLength(5);
    expect(sectionsForPath("/settings/company")).toHaveLength(4);
  });

  it("draws NOTHING for an area with a single screen", () => {
    // A list of one item is furniture: it takes a column of the window to say nothing, and the page
    // should have that column instead.
    expect(sectionsForPath("/overview")).toEqual([]);
    expect(sectionsForPath("/support")).toEqual([]);
  });

  /*
   * Unlike the horizontal version this replaces, the panel STAYS on a detail page. Down the side it
   * competes with nothing — while a second row of tabs above the client's own three was exactly the
   * "two menus at once" problem. Losing the menu when you drill in is how somebody gets stranded.
   */
  it("stays on a detail page rather than vanishing when you drill in", () => {
    expect(sectionsForPath("/clients/abc123").map((s) => s.href)).toEqual(["/clients", "/leads"]);
    expect(sectionsForPath("/integrations/stripe")).toHaveLength(5);
  });

  it("keeps the parent section highlighted on a detail page", () => {
    const sections = sectionsForPath("/integrations/stripe");
    expect(activeSection("/integrations/stripe", sections)).toBe("/integrations");
    expect(activeSection("/clients/abc", sectionsForPath("/clients/abc"))).toBe("/clients");
  });
});
