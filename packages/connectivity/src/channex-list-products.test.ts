import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannexChannelAdapter } from "./channex-channel-adapter.js";

/**
 * The two things `listProducts` got wrong for months, both verified against the live Channex API on
 * 2026-09-17 and both silent:
 *
 *   1. It read the first ten rows of a paginated collection and called that the property's catalogue.
 *   2. It read `attributes.room_type_id`, a field that does not exist, and got `undefined` — which
 *      is indistinguishable from "the channel did not say which room this plan belongs to".
 *
 * Neither failed. Both truncated.
 */

const PROP = "prop-1";
const ROOM_A = "room-a";
const ROOM_B = "room-b";

function plan(id: string, title: string, room: string, parent?: string) {
  return {
    id,
    attributes: { title },
    relationships: {
      room_type: { data: { id: room } },
      ...(parent ? { parent_rate_plan: { data: { id: parent } } } : {}),
    },
  };
}

/** A Channex that paginates exactly as the real one does: `pagination[page]` / `pagination[limit]`. */
function channexWith(rates: unknown[], rooms: unknown[] = []) {
  const seen: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      seen.push(url);
      const u = new URL(url);
      const all = url.includes("/rate_plans") ? rates : rooms;
      const limit = Number(u.searchParams.get("pagination[limit]") ?? 10);
      const page = Number(u.searchParams.get("pagination[page]") ?? 1);
      const data = all.slice((page - 1) * limit, page * limit);
      return new Response(JSON.stringify({ data, meta: { total: all.length, limit, page } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return seen;
}

const adapter = () =>
  new ChannexChannelAdapter({ apiKey: "k", propertyId: PROP, baseUrl: "https://app.channex.io/api/v1", minRequestGapMs: 0 });

afterEach(() => vi.unstubAllGlobals());

describe("listProducts", () => {
  it("reads the room type out of `relationships`, where Channex actually puts it", async () => {
    channexWith([plan("p1", "BB BAR", ROOM_A)]);
    const { rates } = await adapter().listProducts();
    expect(rates[0]?.roomTypeId).toBe(ROOM_A);
  });

  it("recognises a derived plan by its parent relationship", async () => {
    channexWith([plan("p1", "BB BAR", ROOM_A), plan("p2", "BB BAR - BookingCom X", ROOM_A, "p1")]);
    const { rates } = await adapter().listProducts();
    expect(rates.find((r) => r.id === "p1")?.derived).toBe(false);
    expect(rates.find((r) => r.id === "p2")).toMatchObject({ derived: true, parentId: "p1", kind: "channel_scoped" });
  });

  /*
   * Cabacum Beach Residence has 12 rate plans and a default page is 10. The eleventh and twelfth did
   * not exist as far as this platform was concerned — not offerable, and a mapping pointing at one
   * of them would have read as "the channel no longer has this plan".
   */
  it("returns every plan past the first page, not the first ten", async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => plan(`p${i}`, `BB ${i}`, i % 2 ? ROOM_A : ROOM_B));
    channexWith(twelve);
    const { rates } = await adapter().listProducts();
    expect(rates).toHaveLength(12);
    expect(rates.map((r) => r.id)).toContain("p11");
  });

  it("asks for a page with the parameter Channex honours", async () => {
    const seen = channexWith([plan("p1", "BB BAR", ROOM_A)]);
    await adapter().listProducts();
    // `page[limit]`, `page`, and `limit` are all accepted with a 200 and silently ignored.
    expect(seen.every((u) => u.includes("pagination%5Bpage%5D=1") || u.includes("pagination[page]=1"))).toBe(true);
  });

  it("returns nothing rather than a truncated list when the channel refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: {} }), { status: 401 })));
    await expect(adapter().listProducts()).resolves.toEqual({ rooms: [], rates: [] });
  });
});
