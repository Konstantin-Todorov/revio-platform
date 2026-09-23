import { describe, expect, it } from "vitest";
import { channelJourney, type JourneyFacts } from "./channel-journey.js";

const base: JourneyFacts = {
  channelName: "Booking.com", onChannex: true, mappingRows: 6, mappingComplete: 6, status: "connected",
  verifiedAt: new Date("2026-09-23"), bookingsReceived: 3, mappingHref: "/mapping?ch=booking",
};
const nextOf = (f: Partial<JourneyFacts>) => channelJourney({ ...base, ...f }).find((s) => s.next);

describe("channelJourney", () => {
  it("has no next step once a booking has arrived", () => {
    expect(nextOf({})).toBeUndefined();
  });
  it("points at mapping with the count left, and a button", () => {
    const n = nextOf({ mappingComplete: 4 })!;
    expect(n.key).toBe("mapped");
    expect(n.next).toMatch(/2 of 6/);
    expect(n.action?.href).toBe("/mapping?ch=booking");
  });
  it("says the OTA approval is not the hotel's software step — and offers no button for it", () => {
    const n = nextOf({ status: "pending" })!;
    expect(n.key).toBe("live");
    expect(n.next).toMatch(/approve the connection inside its own extranet/);
    expect(n.action).toBeUndefined();
  });
  it("asks for a Verify before a quiet channel is called working", () => {
    expect(nextOf({ verifiedAt: null })?.key).toBe("verified");
  });
  it("tells a hotel with no bookings yet that silence is normal once all else is done", () => {
    expect(nextOf({ bookingsReceived: 0 })?.next).toMatch(/only means nobody has booked/);
  });
  it("an empty mapping is not a complete one", () => {
    expect(nextOf({ mappingRows: 0, mappingComplete: 0 })?.key).toBe("mapped");
  });
  it("exactly one step is next", () => {
    expect(channelJourney({ ...base, onChannex: false, status: "pending", verifiedAt: null, bookingsReceived: 0 }).filter((s) => s.next)).toHaveLength(1);
  });
});
