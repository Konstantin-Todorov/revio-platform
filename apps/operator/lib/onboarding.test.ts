import { describe, expect, it } from "vitest";
import { SETUP_GRACE_DAYS, clientSetup, daysSince, setupStalled } from "./onboarding";
import { reviolinkSetup, type SetupFacts } from "@revio/core";

const EMPTY: SetupFacts = {
  roomTypes: 0,
  ratePlans: 1,
  hasRates: false,
  channels: 0,
  mappingComplete: false,
  units: 0,
  staff: 1,
  hasTaxes: false,
  catalogItems: 0,
  reservations: 0,
};

const TRADING: SetupFacts = {
  roomTypes: 6,
  ratePlans: 3,
  hasRates: true,
  channels: 2,
  mappingComplete: true,
  units: 24,
  staff: 4,
  hasTaxes: true,
  catalogItems: 12,
  reservations: 40,
};

const ALL = { channelManager: true, reservation: true, pms: true };
const CM_ONLY = { channelManager: true, reservation: false, pms: false };

describe("clientSetup", () => {
  it("shows only the products the client bought", () => {
    expect(clientSetup(EMPTY, CM_ONLY).products.map((p) => p.name)).toEqual(["RevioLink"]);
    expect(clientSetup(EMPTY, ALL).products.map((p) => p.name)).toEqual(["RevioLink", "RevioCRS", "RevioPMS"]);
  });

  it("never reports a product they did not buy as unfinished", () => {
    // A wall of red for a client who is fine is how a console teaches people to ignore it.
    const setup = clientSetup(EMPTY, CM_ONLY);
    expect(setup.incomplete.every((p) => p.key === "cm")).toBe(true);
  });

  it("reports a client with nothing set up as incomplete", () => {
    const setup = clientSetup(EMPTY, ALL);
    expect(setup.complete).toBe(false);
    expect(setup.done).toBeLessThan(setup.total);
  });

  it("reports a trading client as complete", () => {
    const setup = clientSetup(TRADING, ALL);
    expect(setup.complete).toBe(true);
    expect(setup.incomplete).toHaveLength(0);
    expect(setup.done).toBe(setup.total);
  });

  it("a client with no products at all is not 'complete'", () => {
    // Vacuously finishing zero products would show a green tick beside a client who owns nothing.
    const setup = clientSetup(TRADING, { channelManager: false, reservation: false, pms: false });
    expect(setup.complete).toBe(false);
    expect(setup.total).toBe(0);
  });

  it("totals across every product bought", () => {
    const one = clientSetup(EMPTY, CM_ONLY);
    const three = clientSetup(EMPTY, ALL);
    expect(three.total).toBe(one.total * 3);
  });
});

describe("the numbers are the hotel's own", () => {
  it("matches @revio/core exactly — not a second definition", () => {
    // If these ever diverge, an operator rings a hotel about a step that is not on their screen.
    const ours = clientSetup(EMPTY, CM_ONLY).products[0]!.progress;
    const theirs = reviolinkSetup(EMPTY);
    expect(ours).toEqual(theirs);
  });
});

describe("nextStep", () => {
  it("names the step in the hotel's words, not ours", () => {
    const next = clientSetup(EMPTY, CM_ONLY).nextStep;
    expect(next?.title).toBe("Add your room types");
    expect(next?.product).toBe("RevioLink");
  });

  it("points at the least-finished product when several are behind", () => {
    // Room types done (helps every product); RevioLink still needs rates+channels+mapping, so it is
    // further behind than RevioCRS and is where the call should start.
    const partial: SetupFacts = { ...EMPTY, roomTypes: 4, hasTaxes: true };
    const next = clientSetup(partial, ALL).nextStep;
    expect(next?.product).toBe("RevioLink");
  });

  it("is null once everything is done", () => {
    expect(clientSetup(TRADING, ALL).nextStep).toBeNull();
  });
});

describe("setupStalled", () => {
  it("stays quiet inside the grace period — everything is unfinished on day one", () => {
    expect(setupStalled(clientSetup(EMPTY, ALL), 1)).toBe(false);
    expect(setupStalled(clientSetup(EMPTY, ALL), SETUP_GRACE_DAYS)).toBe(false);
  });

  it("fires once the client has had a fair chance", () => {
    expect(setupStalled(clientSetup(EMPTY, ALL), SETUP_GRACE_DAYS + 1)).toBe(true);
  });

  it("never fires for a client who finished, however old", () => {
    expect(setupStalled(clientSetup(TRADING, ALL), 900)).toBe(false);
  });

  it("never fires for a client with no products", () => {
    const none = clientSetup(EMPTY, { channelManager: false, reservation: false, pms: false });
    expect(setupStalled(none, 900)).toBe(false);
  });
});

describe("daysSince", () => {
  it("floors to whole days", () => {
    const now = new Date("2026-08-12T12:00:00Z");
    expect(daysSince(new Date("2026-08-12T00:00:00Z"), now)).toBe(0);
    expect(daysSince(new Date("2026-08-11T00:00:00Z"), now)).toBe(1);
  });

  it("never returns a negative age for a future date", () => {
    const now = new Date("2026-08-12T00:00:00Z");
    expect(daysSince(new Date("2026-09-01T00:00:00Z"), now)).toBe(0);
  });
});
