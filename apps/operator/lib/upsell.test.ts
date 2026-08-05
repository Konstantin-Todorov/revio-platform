import { describe, expect, it } from "vitest";
import { clientOpportunities, pipelineMinor, type UpsellSignals } from "./upsell.js";
import { tierDrift, tierForRooms } from "./pricing.js";

/** A fully-loaded client with nothing left to sell. Each test removes exactly one thing. */
const maxed = (o: Partial<UpsellSignals> = {}): UpsellSignals => ({
  plan: "growth",
  entitlements: { channelManager: true, reservation: true, pms: true },
  rooms: 40,
  properties: 1,
  reservationsLast30d: 60,
  commissionPaidLast30dMinor: 40_000,
  blendedOtaRatePct: 15,
  directRevenueLast30dMinor: 20_000,
  bookingEngineProperties: 1,
  channelsConnected: 4,
  ...o,
});

describe("tier drift", () => {
  it("maps room counts to the documented bands", () => {
    expect(tierForRooms(12).plan).toBe("starter");
    expect(tierForRooms(30).plan).toBe("starter"); // boundary is inclusive
    expect(tierForRooms(31).plan).toBe("growth");
    expect(tierForRooms(50).plan).toBe("growth");
    expect(tierForRooms(51).plan).toBe("scale");
    expect(tierForRooms(400).plan).toBe("enterprise");
  });

  it("is silent when the plan already matches", () => {
    expect(tierDrift("growth", 40)).toBeNull();
  });

  it("reports under-billing as a positive delta", () => {
    // starter base 0 → growth base 5000
    expect(tierDrift("starter", 42)!.monthlyDeltaMinor).toBe(5_000);
  });

  it("reports OVER-billing just as plainly", () => {
    // A hotel that closed a wing is still paying the bigger tier. Finding out from us is the
    // difference between a credit note and a cancellation.
    const d = tierDrift("scale", 20)!;
    expect(d.correctPlan).toBe("starter");
    expect(d.monthlyDeltaMinor).toBe(-15_000);
  });
});

describe("clientOpportunities", () => {
  it("finds nothing to sell a fully-loaded client", () => {
    expect(clientOpportunities(maxed())).toEqual([]);
  });

  it("never pitches an upgrade to a client who is over-paying", () => {
    // tierDrift returns a negative delta; that is a credit conversation, not an opportunity.
    const ops = clientOpportunities(maxed({ plan: "scale", rooms: 20 }));
    expect(ops.some((o) => o.kind === "plan_tier")).toBe(false);
  });

  it("prices RevioDirect from the client's OWN commission, not an industry average", () => {
    const ops = clientOpportunities(maxed({ bookingEngineProperties: 0 }));
    const direct = ops.find((o) => o.kind === "enable_direct")!;
    expect(direct.clientValueMinor).toBe(6_000); // 15% of €400.00 commission
    expect(direct.monthlyUpliftMinor).toBe(0); // RevioDirect is not separately billed
    expect(direct.evidence.join(" ")).toMatch(/blended OTA rate 15\.0%/);
  });

  it("stays silent about RevioDirect when there is no commission to point at", () => {
    // No OTA revenue means no rate to reason from — the same refusal channelEconomics makes.
    const ops = clientOpportunities(
      maxed({ bookingEngineProperties: 0, commissionPaidLast30dMinor: 0, blendedOtaRatePct: null }),
    );
    expect(ops.some((o) => o.kind === "enable_direct")).toBe(false);
  });

  it("labels the direct pitch as fair, not strong", () => {
    // The commission is fact; the share that shifts direct is an assumption, and the confidence
    // has to say so or the estimate reads as hard as the fact beside it.
    const direct = clientOpportunities(maxed({ bookingEngineProperties: 0 })).find((o) => o.kind === "enable_direct")!;
    expect(direct.confidence).toBe("fair");
    expect(direct.evidence.join(" ")).toMatch(/the one estimate here/);
  });

  it("pitches the CRS on booking volume, not on absence alone", () => {
    const quiet = clientOpportunities(
      maxed({ entitlements: { channelManager: true, reservation: false, pms: false }, reservationsLast30d: 3, rooms: 20 }),
    );
    const busy = clientOpportunities(
      maxed({ entitlements: { channelManager: true, reservation: false, pms: false }, reservationsLast30d: 60, rooms: 20 }),
    );
    // Not owning the CRS is not an opportunity. Managing 60 bookings without one is.
    expect(quiet.some((o) => o.kind === "add_reservation")).toBe(false);
    expect(busy.some((o) => o.kind === "add_reservation")).toBe(true);
  });

  it("only pitches the PMS to someone already on the CRS", () => {
    // Selling front-desk operations to a hotel with no system of record is selling the roof first.
    const noCrs = clientOpportunities(maxed({ entitlements: { channelManager: true, reservation: false, pms: false } }));
    expect(noCrs.some((o) => o.kind === "add_pms")).toBe(false);
  });

  it("flags a paid-for product delivering nothing, as a retention save", () => {
    const ops = clientOpportunities(maxed({ channelsConnected: 0 }));
    const save = ops.find((o) => o.kind === "connect_channels")!;
    expect(save.monthlyUpliftMinor).toBe(0);
    expect(save.rationale).toMatch(/defend at renewal/);
  });

  it("orders by what it is worth, so the list reads as a call sheet", () => {
    const ops = clientOpportunities(
      maxed({
        plan: "starter",
        rooms: 42,
        entitlements: { channelManager: true, reservation: false, pms: false },
        bookingEngineProperties: 0,
      }),
    );
    const uplifts = ops.map((o) => o.monthlyUpliftMinor);
    expect(uplifts).toEqual([...uplifts].sort((a, b) => b - a));
    expect(ops[0]!.kind).toBe("add_reservation"); // €59.00 beats the €50.00 tier bump
  });

  it("sums only real MRR into the pipeline", () => {
    // Zero-uplift entries (RevioDirect, retention saves) must not inflate a revenue figure.
    const ops = clientOpportunities(maxed({ bookingEngineProperties: 0, channelsConnected: 0 }));
    expect(ops.length).toBeGreaterThan(0);
    expect(pipelineMinor(ops)).toBe(0);
  });
});
