import { describe, it, expect } from "vitest";
import { ChannexChannelAdapter } from "./channex-channel-adapter.js";
import type { AriUpdate } from "@revio/core";

/**
 * Channex rejects individual values inside an HTTP 200.
 *
 * Verified live against the sandbox before this was written: two rates sent, one of them 0, and the
 * response was 200 with `"message": "Success"`, a task id, and the bad one buried in
 * `meta.warnings`. Trusting the status code means a hotel sets a price, sees it confirmed, and the
 * OTA never receives it — which is worse than an error, because nobody goes looking.
 */

const REAL_RESPONSE = {
  data: [{ id: "76899adb-c971-4fbd-b717-08cead94d58c", type: "task" }],
  meta: {
    message: "Success",
    warnings: [
      {
        warning: { rate: ["must be greater than 0"] },
        date: "2027-03-02",
        property_id: "a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9",
        rate_plan_id: "f415d8f1-2f1e-47e2-84a2-6135de71795b",
        rate: 0,
      },
    ],
  },
};

function adapterWith(response: unknown, status = 200) {
  const adapter = new ChannexChannelAdapter({
    apiKey: "k", propertyId: "p", baseUrl: "https://example.invalid/api/v1", channelCode: "booking",
  });
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(response), { status, headers: { "content-type": "application/json" } })) as typeof fetch;
  return adapter;
}

const update = (date: string, externalRateId: string): AriUpdate => ({
  externalRoomId: "room-1", externalRateId, date,
  priceMinor: 12000, currency: "EUR", bookable: 3, restrictions: {},
});

describe("meta.warnings inside a 200", () => {
  it("does NOT report success when a value was rejected", () => {
    // The whole bug in one assertion.
    const a = adapterWith(REAL_RESPONSE);
    return a.pushAri([update("2027-03-02", "f415d8f1-2f1e-47e2-84a2-6135de71795b")]).then((res) => {
      expect(res.ok).toBe(false);
    });
  });

  it("surfaces the channel's own words, so the hotel can act on it", async () => {
    const a = adapterWith(REAL_RESPONSE);
    const res = await a.pushAri([update("2027-03-02", "f415d8f1-2f1e-47e2-84a2-6135de71795b")]);
    const reasons = res.rejected.map((r) => r.reason).join(" | ");
    expect(reasons).toContain("rate must be greater than 0");
    expect(reasons).toContain("2027-03-02");
  });

  it("attaches the rejection to the update it belongs to", async () => {
    // Two dates pushed, one rejected. The Error Center must point at the cell that failed, not at
    // whichever update happened to be first.
    const a = adapterWith(REAL_RESPONSE);
    const res = await a.pushAri([
      update("2027-03-01", "f415d8f1-2f1e-47e2-84a2-6135de71795b"),
      update("2027-03-02", "f415d8f1-2f1e-47e2-84a2-6135de71795b"),
    ]);
    const rejectedDates = res.rejected.map((r) => r.update.date);
    expect(rejectedDates).toContain("2027-03-02");
    expect(rejectedDates).not.toContain("2027-03-01");
  });

  it("still reports success when there are no warnings", async () => {
    const a = adapterWith({ data: [{ id: "task-1", type: "task" }], meta: { message: "Success" } });
    const res = await a.pushAri([update("2027-03-01", "rate-1")]);
    expect(res.ok).toBe(true);
    expect(res.rejected).toHaveLength(0);
  });

  it("keeps the task id — a partial failure is still a real push worth auditing", async () => {
    const a = adapterWith(REAL_RESPONSE);
    const res = await a.pushAri([update("2027-03-02", "f415d8f1-2f1e-47e2-84a2-6135de71795b")]);
    expect(res.tasks?.some((t) => t.id === "76899adb-c971-4fbd-b717-08cead94d58c")).toBe(true);
  });

  it("flattens several problems on one value", async () => {
    const a = adapterWith({
      data: [{ id: "t", type: "task" }],
      meta: { warnings: [{ warning: { rate: ["must be greater than 0", "is invalid"] }, date: "2027-03-02" }] },
    });
    const res = await a.pushAri([update("2027-03-02", "rate-1")]);
    expect(res.rejected[0]!.reason).toContain("must be greater than 0");
    expect(res.rejected[0]!.reason).toContain("is invalid");
  });

  it("survives a warning shape it has never seen", async () => {
    // Never throw inside the response parser: a malformed warning must not take down a push that
    // otherwise worked.
    const a = adapterWith({ data: [{ id: "t", type: "task" }], meta: { warnings: [null, "odd", {}] } });
    const res = await a.pushAri([update("2027-03-01", "rate-1")]);
    expect(res.ok).toBe(false);
    expect(res.rejected.length).toBeGreaterThan(0);
  });

  it("ignores a meta with no warnings array at all", async () => {
    const a = adapterWith({ data: [{ id: "t", type: "task" }], meta: { message: "Success", warnings: null } });
    const res = await a.pushAri([update("2027-03-01", "rate-1")]);
    expect(res.ok).toBe(true);
  });
});
