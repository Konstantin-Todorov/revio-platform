import { describe, expect, it } from "vitest";
import { navTail } from "@revio/ui/nav-tail";

/**
 * The bottom of the menu, which must be the same in all three products.
 *
 * The founder asked for this on 2026-09-11: *"more similar ending with help and settings everywhere
 * to be in the bottom because they have to be easy to find."* These assertions are what "the same"
 * means, so a future edit to one product's sidebar cannot quietly diverge.
 */

describe("the shared tail", () => {
  it("always ends with Settings", () => {
    // The bottom corner is the strongest muscle-memory target a sidebar has, and every operating
    // system these people use puts Settings there.
    for (const routes of [
      ["/activity", "/help", "/settings"],
      ["/help", "/settings"],
      ["/settings"],
    ]) {
      const tail = navTail(routes);
      expect(tail.at(-1)?.href, routes.join(",")).toBe("/settings");
    }
  });

  it("puts Help directly above Settings wherever both exist", () => {
    // The two are reached in the same frame of mind: stuck, or wanting to change how this works.
    const tail = navTail(["/activity", "/help", "/settings"]);
    expect(tail.map((t) => t.href)).toEqual(["/activity", "/help", "/settings"]);
  });

  it("keeps the order when a product lacks one of them", () => {
    // RevioLink has no /activity. Dropping an item must not reshuffle the rest.
    expect(navTail(["/help", "/settings"]).map((t) => t.href)).toEqual(["/help", "/settings"]);
  });

  it("never invents a destination the product does not have", () => {
    // A menu item leading to a 404 is worse than a missing one.
    expect(navTail([]).length).toBe(0);
    expect(navTail(["/settings"]).map((t) => t.href)).toEqual(["/settings"]);
  });

  it("gives every item an icon and a label", () => {
    for (const item of navTail(["/activity", "/help", "/settings"])) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.Icon).toBeTruthy();
    }
  });
});
