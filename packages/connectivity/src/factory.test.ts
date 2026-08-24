import { describe, it, expect } from "vitest";
import type { AriUpdate } from "@revio/core";
import { createChannelAdapter, ChannexChannelAdapter } from "./index.js";

const update: AriUpdate = {
  externalRoomId: "r1", externalRateId: "rp1", date: "2026-07-01",
  bookable: 5, priceMinor: 12000, currency: "EUR",
  restrictions: { stopSell: false, minLos: 1 },
};

describe("createChannelAdapter", () => {
  it("mock mode pushes everything through (no rejections), no credentials needed", async () => {
    const adapter = createChannelAdapter({ mode: "mock", channelCode: "booking" });
    expect(adapter.channelCode).toBe("booking");
    const res = await adapter.pushAri([update]);
    expect(res.ok).toBe(true);
    expect(res.rejected).toHaveLength(0);
  });

  it("channex modes build a ChannexChannelAdapter from the given credentials", () => {
    const adapter = createChannelAdapter({
      mode: "channex-sandbox", channelCode: "booking",
      channex: { apiKey: "k", propertyId: "p" },
    });
    expect(adapter).toBeInstanceOf(ChannexChannelAdapter);
  });

  it("throws if a channex mode is missing credentials", () => {
    expect(() => createChannelAdapter({ mode: "channex-sandbox", channelCode: "booking" })).toThrow(/credentials/);
  });

  /*
   * An EMPTY credential is the realistic one, and it used to sail straight through.
   * `process.env.CHANNEX_PROD_KEY ?? ""` and `channel.externalPropertyId ?? ""` both produce `""` on
   * a hotel that is simply half-configured, and the request then went out with an empty auth header —
   * a 401 that reads as "Channex rejected us" for a cause that is entirely ours.
   */
  it("refuses an empty API key and names where to set it", () => {
    expect(() =>
      createChannelAdapter({ mode: "channex-prod", channelCode: "booking", channex: { apiKey: "", propertyId: "p" } }),
    ).toThrow(/CHANNEX_PROD_KEY/);
    expect(() =>
      createChannelAdapter({ mode: "channex-sandbox", channelCode: "booking", channex: { apiKey: "   ", propertyId: "p" } }),
    ).toThrow(/CHANNEX_SANDBOX_KEY/);
  });

  it("refuses an empty Channex property id", () => {
    expect(() =>
      createChannelAdapter({ mode: "channex-prod", channelCode: "booking", channex: { apiKey: "k", propertyId: "" } }),
    ).toThrow(/property/i);
  });

  it("still needs no credentials in mock mode — demo hotels must never require a key", () => {
    expect(() => createChannelAdapter({ mode: "mock", channelCode: "booking" })).not.toThrow();
  });
});
