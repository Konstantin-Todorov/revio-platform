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
});
