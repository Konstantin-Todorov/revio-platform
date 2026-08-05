import { describe, expect, it } from "vitest";
import { clientAttention, sortBySeverity, worstSeverity, type ClientSignals } from "./attention.js";

const NOW = new Date("2026-08-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/** A healthy, established client. Each test breaks exactly one thing. */
const healthy = (o: Partial<ClientSignals> = {}): ClientSignals => ({
  status: "active",
  createdAt: daysAgo(200),
  entitlements: { channelManager: true, reservation: true, pms: true },
  properties: 2,
  roomTypes: 6,
  units: 30,
  channels: 4,
  channelsConnected: 4,
  openErrors: 0,
  lastSyncAt: daysAgo(0),
  lastReservationAt: daysAgo(1),
  reservationsLast30d: 40,
  bookingEngineProperties: 1,
  directReservationsLast30d: 5,
  unpaidInvoices: [],
  monthlyPriceMinor: 17700,
  ...o,
});

describe("clientAttention", () => {
  it("says nothing about a healthy client", () => {
    // The most important test here. A console that always shows something teaches you to ignore it.
    expect(clientAttention(healthy(), NOW)).toEqual([]);
  });

  it("stops at the suspension and reports nothing else", () => {
    // Listing "no bookings in 30 days" under a suspended account is telling someone their car won't
    // start while it is up on the ramp.
    const flags = clientAttention(
      healthy({ status: "suspended", openErrors: 9, properties: 0, lastReservationAt: daysAgo(90) }),
      NOW,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.title).toBe("Suspended");
  });

  it("escalates a stalled onboarding once the grace period passes", () => {
    const fresh = clientAttention(healthy({ properties: 0, createdAt: daysAgo(3) }), NOW);
    const stale = clientAttention(healthy({ properties: 0, createdAt: daysAgo(40) }), NOW);
    expect(fresh.find((f) => f.title === "No property yet")!.severity).toBe("soon");
    expect(stale.find((f) => f.title === "No property yet")!.severity).toBe("act");
  });

  it("does not nag a client onboarded yesterday about unused products", () => {
    // Everything is unused on day one. Flagging it is noise.
    const flags = clientAttention(
      healthy({ createdAt: daysAgo(1), units: 0, channelsConnected: 0, channels: 0, directReservationsLast30d: 0 }),
      NOW,
    );
    expect(flags.map((f) => f.title)).not.toContain("RevioPMS unused");
    expect(flags.map((f) => f.title)).not.toContain("No channel connected");
  });

  it("catches a product that is billed for and never set up", () => {
    // The most expensive failure in SaaS: they paid, never set it up, nobody noticed.
    const flags = clientAttention(healthy({ units: 0 }), NOW);
    expect(flags.find((f) => f.title === "RevioPMS unused")).toBeTruthy();
  });

  it("distinguishes no channels at all from channels that never connected", () => {
    const none = clientAttention(healthy({ channels: 0, channelsConnected: 0 }), NOW);
    const some = clientAttention(healthy({ channels: 3, channelsConnected: 0 }), NOW);
    expect(none.find((f) => f.title === "No channel connected")!.detail).toMatch(/no channels set up at all/);
    expect(some.find((f) => f.title === "No channel connected")!.detail).toMatch(/3 channel\(s\) configured/);
  });

  it("treats a pile of sync errors as urgent and a single one as not", () => {
    expect(clientAttention(healthy({ openErrors: 1 }), NOW)[0]!.severity).toBe("soon");
    expect(clientAttention(healthy({ openErrors: 7 }), NOW)[0]!.severity).toBe("act");
  });

  it("flags a stale sync only when channels are actually connected", () => {
    const connected = clientAttention(healthy({ lastSyncAt: daysAgo(4) }), NOW);
    const notConnected = clientAttention(
      healthy({ lastSyncAt: daysAgo(4), channelsConnected: 0, channels: 0, createdAt: daysAgo(3) }),
      NOW,
    );
    expect(connected.some((f) => f.title.startsWith("No sync for"))).toBe(true);
    // Nothing is connected, so nothing is drifting — the stale timestamp is not the story.
    expect(notConnected.some((f) => f.title.startsWith("No sync for"))).toBe(false);
  });

  it("does not call a brand-new client quiet just because it has never booked", () => {
    // lastReservationAt === null means "never", which the onboarding flags already cover.
    const flags = clientAttention(healthy({ lastReservationAt: null, createdAt: daysAgo(2) }), NOW);
    expect(flags.some((f) => f.title.startsWith("Quiet for"))).toBe(false);
  });

  it("flags a client that used to book and stopped", () => {
    const flags = clientAttention(healthy({ lastReservationAt: daysAgo(45) }), NOW);
    expect(flags.find((f) => f.title === "Quiet for 45 days")).toBeTruthy();
  });

  it("escalates with the number of unpaid invoices, and sums them", () => {
    const one = clientAttention(healthy({ unpaidInvoices: [{ period: "2026-07", amountMinor: 17700, status: "sent" }] }), NOW);
    const two = clientAttention(
      healthy({
        unpaidInvoices: [
          { period: "2026-06", amountMinor: 17700, status: "sent" },
          { period: "2026-07", amountMinor: 17700, status: "draft" },
        ],
      }),
      NOW,
    );
    expect(one[0]!.severity).toBe("soon");
    expect(two[0]!.severity).toBe("act");
    expect(two[0]!.detail).toMatch(/€354\.00 outstanding/);
  });

  it("notices a booking engine that is live but taking nothing", () => {
    const flags = clientAttention(healthy({ directReservationsLast30d: 0 }), NOW);
    const f = flags.find((x) => x.title === "Booking engine live but unused")!;
    expect(f.severity).toBe("note"); // an opportunity, not a fault
  });

  it("spots a CM-only client worth selling the CRS to", () => {
    const flags = clientAttention(
      healthy({
        entitlements: { channelManager: true, reservation: false, pms: false },
        units: 0, // no PMS entitlement, so this must not flag as unused
        bookingEngineProperties: 0,
      }),
      NOW,
    );
    expect(flags.find((f) => f.title === "Expansion candidate")).toBeTruthy();
    expect(flags.some((f) => f.title === "RevioPMS unused")).toBe(false);
  });
});

describe("severity ordering", () => {
  it("puts what is on fire above what is drifting", () => {
    const flags = clientAttention(healthy({ openErrors: 9, directReservationsLast30d: 0, lastReservationAt: daysAgo(60) }), NOW);
    const order = sortBySeverity(flags).map((f) => f.severity);
    expect(order).toEqual([...order].sort((a, b) => ({ act: 0, soon: 1, note: 2 })[a] - ({ act: 0, soon: 1, note: 2 })[b]));
    expect(order[0]).toBe("act");
  });

  it("reports no severity at all for a healthy client", () => {
    expect(worstSeverity(clientAttention(healthy(), NOW))).toBeNull();
  });
});
