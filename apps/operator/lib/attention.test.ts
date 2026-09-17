import { describe, expect, it } from "vitest";
import {
  clientAttention, sortBySeverity, splitByConcern, worstForThem, worstSeverity,
  type AttentionFlag, type ClientSignals,
} from "./attention.js";

const NOW = new Date("2026-08-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

/** A healthy, established client. Each test breaks exactly one thing. */
const healthy = (o: Partial<ClientSignals> = {}): ClientSignals => ({
  status: "active",
  createdAt: daysAgo(200),
  entitlements: { channelManager: true, reservation: true, pms: true },
  properties: 2,
  ownerEmail: "owner@hotelsofia.bg",
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
  /*
   * The only flag in this file raised by the CUSTOMER rather than derived from their behaviour, and
   * the one that costs a sale if it is late: the trial keeps expiring on its own clock while we sit
   * on the request.
   */
  it("raises the loudest flag when a hotel has asked to keep a trial", () => {
    const flags = clientAttention(
      healthy({
        keepRequests: [{ product: "RevioPMS", askedAt: daysAgo(2), endsAt: new Date(NOW.getTime() + 5 * 86_400_000) }],
      }),
      NOW,
    );
    expect(flags[0]!.severity).toBe("act");
    expect(flags[0]!.title).toMatch(/keep RevioPMS/);
    // Both halves a call-back needs: how long ago they asked, and how long is left to answer.
    expect(flags[0]!.detail).toMatch(/2 days ago/);
    expect(flags[0]!.detail).toMatch(/5 days/);
  });

  it("stays silent about a keep request on a SUSPENDED client", () => {
    // Suspension is the whole story while it lasts — the documented rule, restated because merging a
    // new flag source is exactly when an invariant like this gets lost.
    const flags = clientAttention(
      healthy({
        status: "suspended",
        keepRequests: [{ product: "RevioPMS", askedAt: daysAgo(1), endsAt: new Date(NOW.getTime() + 86_400_000) }],
      }),
      NOW,
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.title).toBe("Suspended");
  });

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

describe("a temporary email address", () => {
  it("⚠️ is NOTICED, never treated as a reason to act", () => {
    /*
     * Signup used to REFUSE a disposable domain. That is the obvious control and the wrong trade:
     * an abusive trial costs us thirty days of software that is nearly free to serve, while a real
     * hotel turned away at the door assumes the product is not for them and never tells us. One
     * mistake is recoverable; the other is invisible. So it is a note beside the client, not a wall
     * in front of them.
     */
    const flags = clientAttention(healthy({ ownerEmail: "someone@mailinator.com" }), NOW);
    const flag = flags.find((f) => f.title.includes("temporary email"));
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("note");
  });

  it("says nothing about an ordinary address", () => {
    expect(clientAttention(healthy(), NOW).some((f) => f.title.includes("temporary email"))).toBe(false);
  });

  it("⚠️ says nothing when there is no owner address at all", () => {
    // `null` must not read as "an address that is not disposable" — it is the absence of an answer,
    // and flagging on it would put a note on every client whose owner row has no email.
    expect(clientAttention(healthy({ ownerEmail: null }), NOW).some((f) => f.title.includes("temporary email"))).toBe(false);
  });

  it("does not make a healthy client noisy", () => {
    // The test that matters most in this file: a console that cries wolf gets ignored, which is
    // worse than one that says nothing.
    expect(clientAttention(healthy(), NOW)).toHaveLength(0);
  });
});

describe("shared sign-in addresses", () => {
  const withShared = (shared: { ip: string; clients: string[] }[]) =>
    clientAttention(healthy({ sharedSignInWith: shared }), NOW).filter((f) => f.title.includes("sign-in address"));

  it("says nothing when the client shares an address with nobody", () => {
    expect(withShared([])).toEqual([]);
    expect(clientAttention(healthy({}), NOW).filter((f) => f.title.includes("sign-in address"))).toEqual([]);
  });

  it("is a note for one other client, not something to act on", () => {
    // The common readings — a consultant, a group, a shared office, carrier-grade NAT — are all
    // customers we want. One overlap is not evidence of anything.
    const [flag] = withShared([{ ip: "203.0.113.9", clients: ["Hotel Vitosha"] }]);
    expect(flag?.severity).toBe("note");
    expect(flag?.title).toContain("1 other client");
    expect(flag?.detail).toContain("Hotel Vitosha");
  });

  it("escalates only on volume, where the innocent readings run out", () => {
    const [flag] = withShared([{ ip: "203.0.113.9", clients: ["A Hotel", "B Hotel", "C Hotel"] }]);
    expect(flag?.severity).toBe("soon");
    expect(flag?.title).toContain("3 other clients");
  });

  it("never accuses — it names the likely innocent reason", () => {
    const one = withShared([{ ip: "203.0.113.9", clients: ["Hotel Vitosha"] }])[0];
    const many = withShared([{ ip: "203.0.113.9", clients: ["A", "B", "C", "D"] }])[0];
    for (const f of [one, many]) {
      expect(f?.detail).toMatch(/consultant|group|shared network/i);
      expect(f?.detail).not.toMatch(/fraud|abuse|abusing|fake|cheat/i);
    }
    // Volume reframes it as an opportunity, because that is what several hotels on one desk is.
    expect(many?.detail).toMatch(/bigger account/i);
  });

  it("counts each client once across several shared addresses", () => {
    // The same person on an office address and a phone is one client, not two.
    const [flag] = withShared([
      { ip: "203.0.113.9", clients: ["Hotel Vitosha"] },
      { ip: "198.51.100.4", clients: ["Hotel Vitosha"] },
    ]);
    expect(flag?.title).toContain("1 other client");
  });

  it("names at most three and counts the rest", () => {
    const [flag] = withShared([{ ip: "203.0.113.9", clients: ["A", "B", "C", "D", "E"] }]);
    expect(flag?.detail).toContain("A, B, C");
    expect(flag?.detail).toContain("and 2 more");
  });

  it("stays quiet when an address is shared with no named client", () => {
    // A row with an empty client list is a shared address we could not resolve a name for. Saying
    // "shares an address with 0 other clients" is noise, and noise teaches people to skim.
    expect(withShared([{ ip: "203.0.113.9", clients: [] }])).toEqual([]);
  });
});

describe("a booking that never reached the calendar", () => {
  const withFailed = (failedImports?: { count: number; oldestAt: Date }) =>
    clientAttention(healthy(failedImports ? { failedImports } : {}), NOW);

  it("says nothing when every booking imported", () => {
    expect(withFailed().filter((f) => f.title.includes("calendar"))).toEqual([]);
  });

  it("is `act` from the very first one", () => {
    // The OTA has confirmed it to a guest and we hold no stay. Somebody may arrive to a front desk
    // with no reservation, and the room is still on sale. Nothing else in this file outranks that.
    const [flag] = withFailed({ count: 1, oldestAt: NOW });
    expect(flag?.severity).toBe("act");
    expect(flag?.title).toBe("A booking never reached the calendar");
  });

  it("never softens with age — time makes the arrival closer, not safer", () => {
    const old = withFailed({ count: 2, oldestAt: new Date(NOW.getTime() - 30 * 86_400_000) })[0];
    expect(old?.severity).toBe("act");
    expect(old?.title).toBe("2 bookings never reached the calendar");
    expect(old?.detail).toMatch(/30 days old/);
  });

  it("names both consequences, because either one alone understates it", () => {
    const [flag] = withFailed({ count: 1, oldestAt: NOW });
    expect(flag?.detail).toMatch(/nobody is holding the room/i);
    expect(flag?.detail).toMatch(/guest thinks they have one/i);
    expect(flag?.detail).toMatch(/mapping/i);
  });

  it("still fires for a suspended client", () => {
    // ⚠️ A suspended client normally reports only the suspension. A confirmed booking with no stay
    // behind it is the exception: the guest is still arriving whatever the account is doing.
    const flags = clientAttention(
      healthy({ status: "suspended", failedImports: { count: 1, oldestAt: NOW } }),
      NOW,
    );
    expect(flags.some((f) => f.title.includes("calendar"))).toBe(true);
  });
});

describe("a rate plan publishing to the wrong room", () => {
  const wired = (crossWiredMappings?: { count: number; checkedAt: Date }) =>
    clientAttention(healthy(crossWiredMappings ? { crossWiredMappings } : {}), NOW);

  it("is silent when there is none", () => {
    expect(wired().some((f) => f.title.includes("wrong room"))).toBe(false);
  });

  it("is act, and says the mapping looks finished — because that is why nobody has noticed", () => {
    const [f] = wired({ count: 1, checkedAt: NOW }).filter((x) => x.title.includes("wrong room"));
    expect(f?.severity).toBe("act");
    expect(f?.detail).toMatch(/everything looks finished/i);
    expect(f?.detail).toMatch(/confirmed with the channel today/i);
  });

  it("says how old the confirmation is, because this is the one second-hand signal here", () => {
    const [f] = wired({ count: 2, checkedAt: new Date(NOW.getTime() - 3 * 86_400_000) }).filter((x) =>
      x.title.includes("wrong room"),
    );
    expect(f?.title).toBe("2 rate plans are publishing to the wrong room");
    expect(f?.detail).toMatch(/last confirmed with the channel 3 days ago/i);
  });

  /*
   * Suspension locks staff out of our products. It does not take prices down from Booking.com — the
   * scheduled pull selects channels by `status: "connected"` and asks nothing about tenant status.
   */
  it("survives a suspension", () => {
    const flags = clientAttention(
      healthy({ status: "suspended", crossWiredMappings: { count: 1, checkedAt: NOW } }),
      NOW,
    );
    expect(flags.some((f) => f.title.includes("wrong room"))).toBe(true);
  });
});

describe("the two halves of the feed", () => {
  /*
   * ⚠️ "3 bookings never reached the calendar" and "renews in 12 days" are both true and are not the
   * same kind of thing. Ranked against each other by severity they compete, and on a quiet day the
   * commercial note wins — which is exactly backwards.
   */
  const flags: AttentionFlag[] = [
    { severity: "note", concern: "ours", title: "Renews in 12 days", detail: "" },
    { severity: "act", concern: "theirs", title: "A booking never reached the calendar", detail: "" },
    { severity: "soon", concern: "ours", title: "No contact in 90 days", detail: "" },
    { severity: "soon", concern: "theirs", title: "5 open sync errors", detail: "" },
  ];

  it("separates them, and sorts inside each half", () => {
    const { theirs, ours } = splitByConcern(flags);
    expect(theirs.map((f) => f.title)).toEqual(["A booking never reached the calendar", "5 open sync errors"]);
    expect(ours.map((f) => f.title)).toEqual(["No contact in 90 days", "Renews in 12 days"]);
  });

  it("returns an empty half rather than dropping it — 'nothing is broken' is worth seeing", () => {
    const { theirs, ours } = splitByConcern([{ severity: "note", concern: "ours", title: "x", detail: "" }]);
    expect(theirs).toEqual([]);
    expect(ours).toHaveLength(1);
  });

  /*
   * A list row shows one colour. An unpaid invoice and a broken channel must not produce the same
   * red dot: only one of them means somebody should stop what they are doing.
   */
  it("reads the row's colour from their software alone", () => {
    expect(worstForThem(flags)).toBe("act");
    expect(worstForThem([{ severity: "act", concern: "ours", title: "Suspended", detail: "" }])).toBeNull();
  });
});
