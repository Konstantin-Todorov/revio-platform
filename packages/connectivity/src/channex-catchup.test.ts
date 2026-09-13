import { describe, it, expect, vi } from "vitest";
import {
  ChannexCatchupError, channexApiFor, describeCatchup, sendRatePlanToChannex, sendRoomTypeToChannex,
  type ChannexRow,
} from "./channex-catchup.js";

const room = (id: string, name: string, over = {}) => ({ id, name, totalRooms: 3, maxGuests: 2, ...over });
const plan = (id: string, name: string, over = {}) =>
  ({ id, name, priceLogic: "manual", roomTypeIds: [] as string[], ...over });

/** A fake Channex holding whatever the test says it holds, recording every write. */
function fakeChannex(seed: { rooms?: { id: string; title: string }[]; rates?: { id: string; title: string; room_type_id: string }[] } = {}) {
  const rooms = [...(seed.rooms ?? [])];
  const rates = [...(seed.rates ?? [])];
  const posts: { path: string; body: any }[] = [];
  let n = 0;
  /** Pages the way Channex does, so a test of paging is a test of paging. */
  const page = (path: string, rows: ChannexRow[]) => {
    const n = Number(new URLSearchParams(path.split("?")[1]).get("pagination[page]") ?? 1);
    const limit = Number(new URLSearchParams(path.split("?")[1]).get("pagination[limit]") ?? 100);
    return { data: rows.slice((n - 1) * limit, n * limit) };
  };
  const api = vi.fn(async (method: string, path: string, body?: any) => {
    if (method === "GET" && path.startsWith("/room_types")) {
      return page(path, rooms.map((r) => ({ id: r.id, attributes: { title: r.title } })));
    }
    if (method === "GET" && path.startsWith("/rate_plans")) {
      return page(path, rates.map((r) => ({ id: r.id, attributes: { title: r.title, room_type_id: r.room_type_id } })));
    }
    posts.push({ path, body });
    const id = `new-${++n}`;
    if (path === "/room_types") rooms.push({ id, title: body.room_type.title });
    if (path === "/rate_plans") rates.push({ id, title: body.rate_plan.title, room_type_id: body.rate_plan.room_type_id });
    return { data: { id } };
  });
  return { api, posts, rooms, rates };
}

function recorder() {
  const roomMaps: [string, string][] = [];
  const rateMaps: [string, string, string][] = [];
  return {
    roomMaps,
    rateMaps,
    writes: {
      writeRoomMapping: async (rt: string, ext: string) => { roomMaps.push([rt, ext]); },
      writeRateMapping: async (rp: string, rt: string, ext: string) => { rateMaps.push([rp, rt, ext]); },
    },
  };
}

describe("sendRoomTypeToChannex", () => {
  it("creates the room AND the plans that sell it — a room with no rate plan cannot be booked", async () => {
    const cx = fakeChannex();
    const rec = recorder();
    const r = await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"),
      ratePlans: [plan("rp-1", "BB Flex"), plan("rp-2", "BB NR")],
      writes: rec.writes,
    });

    expect(cx.posts.map((p) => p.path)).toEqual(["/room_types", "/rate_plans", "/rate_plans"]);
    expect(r.steps.filter((s) => s.kind === "ratePlan")).toHaveLength(2);
    expect(rec.roomMaps).toEqual([["rt-new", "new-1"]]);
    expect(rec.rateMaps).toEqual([["rp-1", "rt-new", "new-2"], ["rp-2", "rt-new", "new-3"]]);
  });

  it("⚠️ ADOPTS a room that is already there rather than creating a second one", async () => {
    /*
     * Channex has no unique constraint on a title, so creating blindly gives two rooms nobody can
     * tell apart — that is how one real property came to exist twice while our channel row pointed
     * at a third id. A half-finished earlier attempt must heal, not double.
     */
    const cx = fakeChannex({ rooms: [{ id: "cx-room", title: "Deluxe Suite" }] });
    const rec = recorder();
    const r = await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"),
      ratePlans: [plan("rp-1", "BB Flex")],
      writes: rec.writes,
    });

    expect(cx.posts.filter((p) => p.path === "/room_types")).toHaveLength(0);
    expect(r.steps[0]).toMatchObject({ kind: "roomType", externalId: "cx-room", adopted: true });
    expect(rec.roomMaps).toEqual([["rt-new", "cx-room"]]);
  });

  it("matches a title a person would call the same", async () => {
    const cx = fakeChannex({ rooms: [{ id: "cx-room", title: "  deluxe SUITE " }] });
    const r = await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"), ratePlans: [plan("rp-1", "BB Flex")], writes: recorder().writes,
    });
    expect(r.steps[0]!.adopted).toBe(true);
  });

  it("⚠️ maps the room BEFORE the rate plans, so a refused plan cannot orphan it", async () => {
    const cx = fakeChannex();
    cx.api.mockImplementation(async (method: string, path: string) => {
      if (method === "GET") return { data: [] };
      if (path === "/rate_plans") throw new Error("Channex refused");
      return { data: { id: "cx-room" } };
    });
    const rec = recorder();
    await expect(sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"), ratePlans: [plan("rp-1", "BB Flex")], writes: rec.writes,
    })).rejects.toThrow(/refused/);
    // The id we created is recorded, so the next attempt adopts it instead of making a second room.
    expect(rec.roomMaps).toEqual([["rt-new", "cx-room"]]);
  });

  it("names a derived plan as skipped rather than dropping it", async () => {
    const cx = fakeChannex();
    const r = await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"),
      ratePlans: [plan("rp-1", "BB Flex"), plan("rp-2", "BB Mobile", { priceLogic: "derived" })],
      writes: recorder().writes,
    });
    expect(r.skipped).toEqual([{ name: "BB Mobile", why: "derived — its price follows a parent plan here" }]);
  });

  it("⚠️ refuses a room whose every plan is derived — Channex would hold an unbookable room", async () => {
    const cx = fakeChannex();
    await expect(sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"),
      ratePlans: [plan("rp-2", "BB Mobile", { priceLogic: "derived" })],
      writes: recorder().writes,
    })).rejects.toThrow(/no rate plan that sets its own prices/);
  });

  it("sends only the plans linked to this room when plans name their rooms", async () => {
    const cx = fakeChannex();
    const rec = recorder();
    await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-a", "Studio"),
      ratePlans: [plan("rp-1", "BB Flex", { roomTypeIds: ["rt-a"] }), plan("rp-2", "Suite Only", { roomTypeIds: ["rt-b"] })],
      writes: rec.writes,
    });
    expect(rec.rateMaps.map((m) => m[0])).toEqual(["rp-1"]);
  });
});

describe("sendRatePlanToChannex", () => {
  const rooms = [
    { ...room("rt-a", "Studio"), externalRoomId: "cx-a" },
    { ...room("rt-b", "Suite"), externalRoomId: "cx-b" },
  ];

  it("⚠️ creates ONE Channex rate plan per room — that asymmetry is what BUG-019 is made of", async () => {
    const cx = fakeChannex();
    const rec = recorder();
    const r = await sendRatePlanToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex"), rooms, writes: rec.writes,
    });
    expect(cx.posts).toHaveLength(2);
    expect(cx.posts.map((p) => p.body.rate_plan.room_type_id)).toEqual(["cx-a", "cx-b"]);
    expect(rec.rateMaps).toEqual([["rp-1", "rt-a", "new-1"], ["rp-1", "rt-b", "new-2"]]);
    expect(r.steps.every((s) => !s.adopted)).toBe(true);
  });

  it("⚠️ does NOT create a room as a side effect — it says the room must be sent first", async () => {
    // Creating the room here would put a room on sale that nobody asked to put on sale.
    const cx = fakeChannex();
    const r = await sendRatePlanToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex"),
      rooms: [rooms[0]!, { ...room("rt-c", "Penthouse"), externalRoomId: null }],
      writes: recorder().writes,
    });
    expect(cx.posts.filter((p) => p.path === "/room_types")).toHaveLength(0);
    expect(r.skipped).toEqual([{ name: "Penthouse", why: "this room has not reached Channex yet — send the room first" }]);
    expect(r.steps).toHaveLength(1);
  });

  it("adopts a rate plan already on that room", async () => {
    const cx = fakeChannex({ rates: [{ id: "cx-rate", title: "BB Flex", room_type_id: "cx-a" }] });
    const rec = recorder();
    const r = await sendRatePlanToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex", { roomTypeIds: ["rt-a"] }), rooms, writes: rec.writes,
    });
    expect(cx.posts).toHaveLength(0);
    expect(r.steps[0]).toMatchObject({ externalId: "cx-rate", adopted: true });
    expect(rec.rateMaps).toEqual([["rp-1", "rt-a", "cx-rate"]]);
  });

  it("⚠️ a plan of the same name on a DIFFERENT room is not the same plan", async () => {
    // Channex rate plans are per room type. Matching on title alone would map the Suite's plan to
    // the Studio and publish the Studio's price against the Suite — BUG-019 exactly.
    const cx = fakeChannex({ rates: [{ id: "cx-rate", title: "BB Flex", room_type_id: "cx-b" }] });
    const rec = recorder();
    await sendRatePlanToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex", { roomTypeIds: ["rt-a"] }), rooms, writes: rec.writes,
    });
    expect(cx.posts).toHaveLength(1);
    expect(rec.rateMaps).toEqual([["rp-1", "rt-a", "new-1"]]);
  });

  it("refuses a derived plan, and says which plan to send instead", async () => {
    await expect(sendRatePlanToChannex({
      api: fakeChannex().api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Mobile", { priceLogic: "derived" }), rooms, writes: recorder().writes,
    })).rejects.toThrow(ChannexCatchupError);
  });

  it("refuses a plan linked to no room at all", async () => {
    await expect(sendRatePlanToChannex({
      api: fakeChannex().api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "Orphan", { roomTypeIds: ["rt-z"] }), rooms, writes: recorder().writes,
    })).rejects.toThrow(/not linked to any room type/);
  });

  it("⚠️ refuses rather than reporting a success that sent nothing", async () => {
    await expect(sendRatePlanToChannex({
      api: fakeChannex().api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex"),
      rooms: rooms.map((r) => ({ ...r, externalRoomId: null })),
      writes: recorder().writes,
    })).rejects.toThrow(/Nothing was sent/);
  });
});

describe("describeCatchup", () => {
  it("⚠️ keeps created and adopted apart — they answer different questions", () => {
    const s = describeCatchup({
      steps: [
        { kind: "roomType", id: "a", name: "Studio", externalId: "x", adopted: false },
        { kind: "ratePlan", id: "b", name: "BB Flex", externalId: "y", adopted: true },
      ],
      skipped: [],
    });
    expect(s).toContain("1 sent to your channel manager");
    // "already existed and was linked" is the answer to "why is there no new room on Channex".
    expect(s).toContain("1 already existed");
  });

  it("names what it skipped and why", () => {
    expect(describeCatchup({ steps: [], skipped: [{ name: "BB Mobile", why: "derived" }] }))
      .toContain("BB Mobile: derived");
  });

  it("says nothing to send rather than reporting zero of anything", () => {
    expect(describeCatchup({ steps: [], skipped: [] })).toBe("Nothing to send.");
  });
});

describe("channexApiFor — the 401 trap, where it costs a duplicate", () => {
  const config = { apiKey: "k", baseUrl: "https://channex.test" };

  it("⚠️ throws on 401 instead of returning an empty list", async () => {
    /*
     * A 401 has no `data` key, so `Array.isArray(res.data)` reads "no room types here" exactly as an
     * empty property does. In read-before-create that is not a misleading number — it is a WRITE:
     * we would conclude the room is missing and create a second one nobody can tell apart.
     */
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(channexApiFor(config)("GET", "/room_types")).rejects.toThrow(/refused the API key/);
    vi.unstubAllGlobals();
  });

  it("⚠️ a dead key can never reach a create", async () => {
    // The whole point, end to end: the send refuses rather than duplicating the hotel's rooms.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const rec = recorder();
    await expect(sendRoomTypeToChannex({
      api: channexApiFor(config), channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-new", "Deluxe Suite"), ratePlans: [plan("rp-1", "BB Flex")], writes: rec.writes,
    })).rejects.toThrow(/refused the API key/);
    expect(rec.roomMaps).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("passes a 2xx body straight through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    await expect(channexApiFor(config)("GET", "/room_types")).resolves.toEqual({ data: [] });
    vi.unstubAllGlobals();
  });

  it("names the status and the body on any other refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: "title is taken" }), { status: 422 })));
    await expect(channexApiFor(config)("POST", "/room_types", {})).rejects.toThrow(/422.*title is taken/);
    vi.unstubAllGlobals();
  });
});

describe("⚠️ paging — where a truncated listing becomes a duplicate", () => {
  it("reads past the first hundred rate plans and finds the one that is there", async () => {
    /*
     * One Channex rate plan belongs to ONE room type, so a property's plans multiply: ten rooms
     * with ten plans is exactly a hundred. The first version of this module asked for 100 and
     * stopped, so past that it would fail to find a plan that really exists and create a second —
     * the precise duplicate read-before-create is for, reintroduced by an unchecked default.
     */
    const filler = Array.from({ length: 130 }, (_, i) => ({
      id: `cx-${i}`, title: `Filler ${i}`, room_type_id: "cx-a",
    }));
    const cx = fakeChannex({
      rates: [...filler, { id: "cx-wanted", title: "BB Flex", room_type_id: "cx-a" }],
    });
    const rec = recorder();
    const r = await sendRatePlanToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      ratePlan: plan("rp-1", "BB Flex", { roomTypeIds: ["rt-a"] }),
      rooms: [{ ...room("rt-a", "Studio"), externalRoomId: "cx-a" }],
      writes: rec.writes,
    });

    expect(cx.posts).toHaveLength(0); // nothing created
    expect(r.steps[0]).toMatchObject({ externalId: "cx-wanted", adopted: true });
    expect(rec.rateMaps).toEqual([["rp-1", "rt-a", "cx-wanted"]]);
  });

  it("stops at the first short page rather than asking forever", async () => {
    const cx = fakeChannex({ rooms: [{ id: "cx-a", title: "Studio" }] });
    await sendRoomTypeToChannex({
      api: cx.api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-a", "Studio"), ratePlans: [plan("rp-1", "BB Flex")], writes: recorder().writes,
    });
    const roomPages = cx.api.mock.calls.filter(([m, p]) => m === "GET" && String(p).startsWith("/room_types"));
    expect(roomPages).toHaveLength(1);
  });

  it("⚠️ throws rather than returning a partial list if it runs past the cap", async () => {
    // Returning what it has would be the silent truncation again, one order of magnitude further
    // out — and silent truncation is how this creates duplicates.
    const api = vi.fn(async () => ({
      data: Array.from({ length: 100 }, (_, i) => ({ id: `x-${i}`, attributes: { title: `T${i}` } })),
    }));
    await expect(sendRoomTypeToChannex({
      api, channexPropertyId: "p1", currency: "EUR",
      roomType: room("rt-a", "Studio"), ratePlans: [plan("rp-1", "BB Flex")], writes: recorder().writes,
    })).rejects.toThrow(/Nothing was sent/);
  });
});
