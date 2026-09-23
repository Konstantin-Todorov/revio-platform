import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannexChannelAdapter } from "./channex-channel-adapter.js";

/**
 * The reads behind the Verify button, held to what the REAL Channex requires.
 *
 * `readPublishedRates` shipped without `filter[restrictions]` and every call against sandbox and
 * production answered 400 "restrictions is required" — found 2026-09-23 by running the check
 * read-only against production. Its tests faked a 200, and a fake that accepts any URL cannot notice
 * a missing parameter. This one refuses the request the way Channex does.
 */
function strictChannex(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/restrictions") && !u.searchParams.get("filter[restrictions]")) {
        return new Response(JSON.stringify({ errors: { code: "bad_request", details: ["restrictions is required"] } }), { status: 400 });
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
}

const adapter = () => new ChannexChannelAdapter({ apiKey: "k", propertyId: "prop-1" });

afterEach(() => vi.unstubAllGlobals());

describe("readPublishedRates", () => {
  it("asks for the restrictions Channex requires, and reads the rate in minor units", async () => {
    strictChannex({ data: { "rate-1": { "2026-11-02": { rate: "122.78", unavailable_reasons: [] } } } });
    const r = await adapter().readPublishedRates("2026-11-02", "2026-11-02");
    expect(r).toEqual({ ok: true, rates: [{ externalRateId: "rate-1", date: "2026-11-02", priceMinor: 12278 }] });
  });
});

describe("readPublishedAvailability", () => {
  it("reads rooms offered per room type and date", async () => {
    strictChannex({ data: { "room-1": { "2026-11-02": 5, "2026-11-03": 0 } } });
    const r = await adapter().readPublishedAvailability("2026-11-02", "2026-11-03");
    expect(r).toEqual({ ok: true, rows: [
      { externalRoomId: "room-1", date: "2026-11-02", count: 5 },
      { externalRoomId: "room-1", date: "2026-11-03", count: 0 },
    ] });
  });
  it("a failed read is an error, never an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const r = await adapter().readPublishedAvailability("2026-11-02", "2026-11-03");
    expect(r.ok).toBe(false);
  });
});

describe("pushAvailability — one stop-sold plan must not close the room", () => {
  function capture() {
    const bodies: { values: { room_type_id: string; availability: number }[] }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ data: [{ id: "task", type: "task" }] }), { status: 200 });
    }));
    return bodies;
  }
  const u = (rate: string, bookable: number) => ({
    externalRoomId: "room-1", externalRateId: rate, date: "2026-11-02", currency: "EUR", restrictions: {}, bookable,
  });

  it.each([
    ["the stopped plan last", [u("flex", 4), u("nonref", 0)]],
    ["the stopped plan first", [u("nonref", 0), u("flex", 4)]],
  ])("sends the room's real count with %s", async (_label, updates) => {
    const bodies = capture();
    await new ChannexChannelAdapter({ apiKey: "k", propertyId: "prop-1", minRequestGapMs: 0 }).pushAvailability(updates);
    expect(bodies[0]!.values).toEqual([expect.objectContaining({ room_type_id: "room-1", availability: 4 })]);
  });

  it("closes the room when every plan it sells is closed", async () => {
    const bodies = capture();
    await new ChannexChannelAdapter({ apiKey: "k", propertyId: "prop-1", minRequestGapMs: 0 }).pushAvailability([u("flex", 0), u("nonref", 0)]);
    expect(bodies[0]!.values).toEqual([expect.objectContaining({ availability: 0 })]);
  });
});
