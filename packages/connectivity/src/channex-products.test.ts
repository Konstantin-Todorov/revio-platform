import { describe, it, expect } from "vitest";
import { classifyChannexRatePlan, mappableRatePlans, ratePlansForRoom, type ChannexRatePlan } from "./channex-products.js";

const plan = (over: Partial<ChannexRatePlan> = {}): ChannexRatePlan => ({
  id: "p1", name: "BB BAR", roomTypeId: "rt1", kind: "property", derived: false, ...over,
});

describe("classifyChannexRatePlan", () => {
  it("⚠️ recognises the entry that was wrongly mapped in production", () => {
    // 0ea321e7… — the inactive Standard Rate was bound to this on 13 Sept (BUG-020). It is the
    // Booking.com end of the chain, not something RevioLink pushes to.
    const c = classifyChannexRatePlan("BB BAR - BookingCom Cabacum Beach Residence");
    expect(c.kind).toBe("channel_scoped");
    expect(c.channel).toBe("BookingCom");
  });

  it("recognises the other channels Channex scopes to", () => {
    for (const ch of ["Expedia", "Agoda", "Airbnb", "Hotelbeds", "WebBeds"]) {
      expect(classifyChannexRatePlan(`BB NR - ${ch} Some Hotel`).kind).toBe("channel_scoped");
    }
  });

  it("leaves ordinary property plans alone", () => {
    for (const n of ["BB BAR", "BB Non-Refundable", "Standard Rate"]) {
      expect(classifyChannexRatePlan(n).kind).toBe("property");
    }
  });

  it("⚠️ does not mistake a hyphen in a hotel's own plan name for a channel", () => {
    // "Early Bird - Summer" is a plan somebody named, not a channel scope. Over-matching here
    // would hide a real target and leave the room unmappable with no explanation.
    expect(classifyChannexRatePlan("Early Bird - Summer 2026").kind).toBe("property");
    expect(classifyChannexRatePlan("Half Board - Adults Only").kind).toBe("property");
  });

  it("takes the LAST separator, so a hyphenated plan on a channel still classifies", () => {
    expect(classifyChannexRatePlan("Early Bird - Summer - BookingCom X").kind).toBe("channel_scoped");
  });
});

describe("mappableRatePlans", () => {
  it("splits the three kinds rather than hiding two of them", () => {
    const { mappable, derived, excluded } = mappableRatePlans([
      plan({ id: "a", name: "BB BAR" }),
      plan({ id: "b", name: "BB NR", derived: true, parentId: "a" }),
      plan({ id: "c", name: "BB BAR - BookingCom X", kind: "channel_scoped", channel: "BookingCom" }),
    ]);
    expect(mappable.map((p) => p.id)).toEqual(["a"]);
    expect(derived.map((p) => p.id)).toEqual(["b"]);
    expect(excluded.map((p) => p.id)).toEqual(["c"]);
  });

  it("⚠️ reports derived plans instead of swallowing them", () => {
    // "1 unmapped" reads as a fault when BB NR is a complete, correct state that Channex computes
    // (BUG-021). The screen can only say so if it is handed them.
    const { derived } = mappableRatePlans([plan({ id: "b", name: "BB NR", derived: true })]);
    expect(derived).toHaveLength(1);
  });
});

describe("ratePlansForRoom", () => {
  it("offers only the plans belonging to that Channex room type", () => {
    const plans = [
      plan({ id: "a", roomTypeId: "1br" }),
      plan({ id: "b", roomTypeId: "2br" }),
      plan({ id: "c", roomTypeId: "1br" }),
    ];
    expect(ratePlansForRoom(plans, "1br").map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("⚠️ a plan with NO room type is offered to nobody", () => {
    /*
     * The property-wide assumption BUG-019 was made of. If Channex did not say which room a plan
     * belongs to, we cannot place it — and showing it under every room is exactly how a 1-Bedroom
     * price was published against the 2-Bedroom.
     */
    expect(ratePlansForRoom([plan({ id: "x", roomTypeId: null })], "1br")).toHaveLength(0);
  });

  it("never leaks one room's plans into another's list", () => {
    const plans = [plan({ id: "two", roomTypeId: "2br", name: "BB BAR" })];
    expect(ratePlansForRoom(plans, "1br")).toHaveLength(0);
  });
});
