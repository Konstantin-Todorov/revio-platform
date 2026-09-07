import { describe, expect, it } from "vitest";
import { SETUP_KEY, welcomeFlow, type WelcomeFacts } from "@revio/core";
import { otherProducts } from "./welcome-facts.js";

const ALL = { hasChannelManager: true, hasReservation: true, hasPms: true };
const CM_CRS = { hasChannelManager: true, hasReservation: true, hasPms: false };

describe("otherProducts", () => {
  it("counts a product only once its own setup has finished", () => {
    expect(otherProducts(CM_CRS, "RevioLink", [])).toEqual([]);
    expect(otherProducts(CM_CRS, "RevioLink", [SETUP_KEY.RevioCRS])).toEqual(["RevioCRS"]);
  });

  it("never counts the product being onboarded, however complete it is", () => {
    expect(otherProducts(ALL, "RevioCRS", [SETUP_KEY.RevioCRS])).toEqual([]);
  });

  it("ignores a product they never bought, even if the key is somehow present", () => {
    expect(otherProducts(CM_CRS, "RevioLink", [SETUP_KEY.RevioPMS])).toEqual([]);
  });

  it("still honours the older long-form value written into production rows", () => {
    expect(otherProducts(CM_CRS, "RevioLink", ["RevioCRS"])).toEqual(["RevioCRS"]);
  });
});

/**
 * The bug this fix exists for, stated as the flow the hotel walks.
 *
 * A hotel that buys RevioLink and RevioCRS together answers the property screen. Before the fix the
 * answer made PROPERTY "shared with RevioCRS", which removed it from the flow and put the
 * never-satisfiable SHARED screen at position 0 — so the route bounced them backwards, one bounce
 * per step, telling them a product they had never opened had already done their work.
 */
describe("a hotel that bought two products at once", () => {
  const facts = (over: Partial<WelcomeFacts> = {}): WelcomeFacts => ({
    rooms: 12,
    hasPropertyDetails: false,
    hasRoomTypes: false,
    hasUnits: false,
    hasRates: false,
    hasBrand: false,
    hasTaxes: false,
    hasInvoiceIdentity: false,
    hasReservationDelivery: false,
    hasStaff: false,
    alsoRuns: otherProducts(CM_CRS, "RevioLink", []),
    ...over,
  });

  it("is never shown the inherited screen on its first onboarding", () => {
    const keys = welcomeFlow("RevioLink", facts()).map((s) => s.key);
    expect(keys).not.toContain("shared");
  });

  it("keeps the step it is standing on after answering it", () => {
    const before = welcomeFlow("RevioLink", facts()).map((s) => s.key);
    expect(before).toContain("property");

    // They fill the property screen in. Nothing about the flow may move under them.
    const after = welcomeFlow("RevioLink", facts({ hasPropertyDetails: true })).map((s) => s.key);
    expect(after).toEqual(before);
  });

  it("still opens on the inherited screen once the other product really is set up", () => {
    const second = facts({
      hasPropertyDetails: true,
      hasRoomTypes: true,
      alsoRuns: otherProducts(CM_CRS, "RevioLink", [SETUP_KEY.RevioCRS]),
    });
    expect(welcomeFlow("RevioLink", second)[0]!.key).toBe("shared");
  });
});
