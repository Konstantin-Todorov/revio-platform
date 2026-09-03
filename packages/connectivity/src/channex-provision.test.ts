import { describe, it, expect, vi, afterEach } from "vitest";
import { provisionChannexProperty, ChannexProvisionError } from "./channex-provision.js";

/**
 * These tests exist because this function had no direct cover while being the only code that
 * creates a hotel on Channex — an operation whose mistakes are permanent and indistinguishable
 * afterwards. Every case below is a failure this repo has actually had.
 */

const property = {
  id: "p1", name: "Hotel Sofia", baseCurrency: "EUR", timezone: "Europe/Sofia",
  address: "1 Vitosha", contactEmail: "stay@sofia.test", phone: "+359",
};
const room = (id: string, name: string) => ({ id, name, totalRooms: 4, maxGuests: 2 });
const plan = (id: string, name: string, priceLogic = "manual", roomTypeIds: string[] = []) =>
  ({ id, name, priceLogic, roomTypeIds });

const input = (over: Partial<Parameters<typeof provisionChannexProperty>[0]> = {}) => ({
  tenantId: "t1", tenantName: "Sofia Group", property,
  roomTypes: [room("r1", "Double")], ratePlans: [plan("pl1", "Standard")],
  mode: "channex_sandbox", apiKey: "key-123",
  ...over,
});

const writes = () => ({
  writeChannel: vi.fn(async () => ({ id: "ch1" })),
  writeRoomMapping: vi.fn(async () => {}),
  writeRateMapping: vi.fn(async () => {}),
});

/** Stub `fetch`, since the module builds its own client from it. */
function stubFetch(handler: (method: string, path: string, body: any) => { status?: number; json: any }) {
  const calls: { method: string; path: string; body: any }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api\/v1/, "");
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init?.method ?? "GET", path, body });
    const r = handler(init?.method ?? "GET", path, body);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      text: async () => JSON.stringify(r.json),
    } as any;
  }));
  return calls;
}

const happy = (handler?: (m: string, p: string, b: any) => any) =>
  stubFetch((m, p, b) => {
    if (handler) { const h = handler(m, p, b); if (h) return h; }
    if (p === "/properties" && m === "GET") return { json: { data: [] } };
    if (p === "/properties") return { json: { data: { id: "cx-prop" } } };
    if (p === "/room_types") return { json: { data: { id: `cx-room-${b.room_type.title}` } } };
    if (p === "/rate_plans") return { json: { data: { id: `cx-rate-${b.rate_plan.title}` } } };
    return { json: { data: {} } };
  });

afterEach(() => vi.unstubAllGlobals());

describe("what it refuses to start", () => {
  it("refuses without an API key rather than pushing unauthenticated", async () => {
    await expect(provisionChannexProperty(input({ apiKey: "  " }), writes())).rejects.toThrow(ChannexProvisionError);
  });

  it("refuses a property with no room types", async () => {
    await expect(provisionChannexProperty(input({ roomTypes: [] }), writes())).rejects.toThrow(/room types/i);
  });

  it("refuses when every plan is derived — rooms with no sellable rate look provisioned and cannot take a booking", async () => {
    const i = input({ ratePlans: [plan("pl1", "BAR -10%", "derived")] });
    await expect(provisionChannexProperty(i, writes())).rejects.toThrow(/derived/i);
  });

  it("refuses an unknown connectivity mode instead of guessing a host", async () => {
    await expect(provisionChannexProperty(input({ mode: "nonsense" }), writes())).rejects.toThrow(/mode/i);
  });
});

describe("the duplicate it must never create", () => {
  it("refuses when Channex already holds a property with this title", async () => {
    // A duplicate takes its own uuid, is silent, is permanent, and afterwards nobody can tell which
    // of the two the OTAs were mapped against. `Ethno Villa Cherry` exists twice for this reason.
    happy((m, p) => (m === "GET" && p === "/properties"
      ? { json: { data: [{ id: "cx-old", attributes: { title: "  hotel sofia " } }] } }
      : null));
    await expect(provisionChannexProperty(input(), writes())).rejects.toThrow(/already has a property/i);
  });

  it("does not create anything when it refuses", async () => {
    const calls = happy((m, p) => (m === "GET" && p === "/properties"
      ? { json: { data: [{ id: "cx-old", attributes: { title: "Hotel Sofia" } }] } }
      : null));
    await provisionChannexProperty(input(), writes()).catch(() => {});
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});

describe("the id is persisted before anything else can fail", () => {
  it("writes the channel immediately after the property is created", async () => {
    // This used to happen at the very END, so a failure in between left a property in Channex our
    // database had never heard of — and the next attempt made another one beside it.
    happy((m, p) => (p === "/room_types" ? { status: 500, json: { errors: "boom" } } : null));
    const w = writes();
    await provisionChannexProperty(input(), w).catch(() => {});
    expect(w.writeChannel).toHaveBeenCalledWith(
      expect.objectContaining({ channexPropertyId: "cx-prop", propertyId: "p1", tenantId: "t1" }),
    );
  });
});

describe("one Channex rate plan per (room type × manual plan) pair", () => {
  it("three room types and one plan create THREE rate plans", async () => {
    // Channex ties a rate plan to one room type; we model plans at property level. Sending one means
    // the last write wins and two room types are mispriced on every OTA — with everything green.
    const calls = happy();
    const i = input({ roomTypes: [room("a", "Double"), room("b", "Twin"), room("c", "Suite")] });
    const res = await provisionChannexProperty(i, writes());
    expect(calls.filter((c) => c.path === "/rate_plans")).toHaveLength(3);
    expect(res.rateMap).toHaveLength(3);
  });

  it("skips derived plans — Channex only needs the ones we author", async () => {
    const calls = happy();
    const i = input({ ratePlans: [plan("pl1", "Standard"), plan("pl2", "BAR -10%", "derived")] });
    await provisionChannexProperty(i, writes());
    expect(calls.filter((c) => c.path === "/rate_plans")).toHaveLength(1);
  });

  it("honours a plan scoped to specific room types, and treats unscoped as all", async () => {
    const calls = happy();
    const i = input({
      roomTypes: [room("a", "Double"), room("b", "Suite")],
      ratePlans: [plan("pl1", "Suite Only", "manual", ["b"])],
    });
    await provisionChannexProperty(i, writes());
    expect(calls.filter((c) => c.path === "/rate_plans")).toHaveLength(1);
  });

  it("maps every room and every pair once it has them", async () => {
    happy();
    const w = writes();
    await provisionChannexProperty(input(), w);
    expect(w.writeRoomMapping).toHaveBeenCalledWith("ch1", "t1", "r1", "cx-room-Double");
    expect(w.writeRateMapping).toHaveBeenCalledWith("ch1", "t1", "pl1", "r1", "cx-rate-Standard");
  });
});

describe("failures are reported, not swallowed", () => {
  it("surfaces Channex's own refusal text", async () => {
    happy((m, p) => (p === "/properties" && m === "POST"
      ? { status: 422, json: { errors: "title has already been taken" } }
      : null));
    await expect(provisionChannexProperty(input(), writes())).rejects.toThrow(/422.*already been taken/i);
  });
});

describe("dry run — the runbook says always do this first", () => {
  it("validates and checks for a duplicate, but creates NOTHING", async () => {
    const calls = happy();
    const w = writes();
    const res = await provisionChannexProperty(input({ dryRun: true }), w);

    // The read that matters still happens; nothing is written anywhere.
    expect(calls.filter((c) => c.method === "GET" && c.path === "/properties")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(w.writeChannel).not.toHaveBeenCalled();
    expect(w.writeRoomMapping).not.toHaveBeenCalled();
    expect(w.writeRateMapping).not.toHaveBeenCalled();
    // It still reports the shape of what WOULD be created.
    expect(res.roomMap).toHaveLength(1);
    expect(res.rateMap).toHaveLength(1);
  });

  it("still refuses a duplicate, so a rehearsal catches it before the real run", async () => {
    happy((m, p) => (m === "GET" && p === "/properties"
      ? { json: { data: [{ id: "cx-old", attributes: { title: "Hotel Sofia" } }] } }
      : null));
    await expect(provisionChannexProperty(input({ dryRun: true }), writes())).rejects.toThrow(/already has a property/i);
  });
});
