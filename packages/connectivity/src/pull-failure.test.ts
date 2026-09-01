import { describe, it, expect, vi, afterEach } from "vitest";
import { ChannexChannelAdapter } from "./channex-channel-adapter.js";

/**
 * A failed pull must never look like an empty one.
 *
 * On 2026-09-01 the first real hotel's Channex key stopped authenticating. Both pull methods read
 * `if (!res.ok) return []`, so every 401 arrived at the caller as "no new bookings" and the Sync
 * Center wrote **411 consecutive "Pulled 0 revisions · success"** events. The hotel was told its
 * channel was healthy for hours while nothing reached it at all.
 *
 * These tests exist so that line cannot come back. They are deliberately about the SHAPE of the
 * failure — that it throws, and that the reason survives — rather than about any wording.
 */

function adapterWith(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  })));
  return new ChannexChannelAdapter({
    apiKey: "k", propertyId: "p-1", baseUrl: "https://example.test/api/v1", minRequestGapMs: 0,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("pullRevisions", () => {
  it("THROWS on 401 rather than reporting an empty feed", async () => {
    const a = adapterWith(401, { type: "unauthorized" });
    await expect(a.pullRevisions()).rejects.toThrow();
  });

  it("carries the status into the message, so the Sync Center can say why", async () => {
    const a = adapterWith(401, { type: "unauthorized" });
    await expect(a.pullRevisions()).rejects.toThrow(/401|unauthorized/i);
  });

  it("throws on a 500 too — any failure, not just auth", async () => {
    const a = adapterWith(500, { errors: { title: "boom" } });
    await expect(a.pullRevisions()).rejects.toThrow();
  });

  it("still returns an empty array when the feed is genuinely empty", async () => {
    // The distinction that matters: nothing to do is a success, and must stay one.
    const a = adapterWith(200, { data: [] });
    await expect(a.pullRevisions()).resolves.toEqual([]);
  });
});

describe("pullReservations", () => {
  it("THROWS on 401 rather than reporting no bookings", async () => {
    const a = adapterWith(401, { type: "unauthorized" });
    await expect(a.pullReservations("2026-09-01T00:00:00Z")).rejects.toThrow();
  });

  it("still returns an empty array when there are genuinely no bookings", async () => {
    const a = adapterWith(200, { data: [] });
    await expect(a.pullReservations("2026-09-01T00:00:00Z")).resolves.toEqual([]);
  });
});
