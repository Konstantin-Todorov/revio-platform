import { describe, it, expect, vi } from "vitest";
import { applyStructurePlan, describeStructureOutcome } from "./structure-apply.js";
import type { StructurePlan } from "./structure-plan.js";

const ctx = { tenantId: "t1", channelId: "ch1", channexPropertyId: "cx-prop", currency: "EUR" };

const okApi = (id = "cx-new") => vi.fn(async (_m: string, _p: string, _b?: unknown) => ({ data: { id } }));
const writes = () => ({ writeRoomMapping: vi.fn(async () => {}), writeRateMapping: vi.fn(async () => {}) });
const asPlan = (actions: StructurePlan["actions"]): StructurePlan => ({ actions, isEmpty: actions.length === 0 });

describe("creating what Channex does not have", () => {
  it("creates a room type and persists the mapping IMMEDIATELY", async () => {
    // The id Channex returns cannot be recovered later — two products with the same title are
    // indistinguishable. Persisting at the end is how a property came to exist twice.
    const api = okApi("cx-suite");
    const w = writes();
    const out = await applyStructurePlan(
      asPlan([{ kind: "create-room", localId: "suite", name: "Suite", totalRooms: 4, maxGuests: 2 }]),
      ctx, api, w,
    );
    expect(out).toMatchObject({ createdRooms: 1, ok: true });
    expect(w.writeRoomMapping).toHaveBeenCalledWith("ch1", "t1", "suite", "cx-suite");
  });

  it("creates a rate plan against the room id it just made", async () => {
    const api = vi.fn(async (_m: string, path: string, _b?: unknown) => ({
      data: { id: path === "/room_types" ? "cx-room" : "cx-rate" },
    }));
    const w = writes();
    const out = await applyStructurePlan(
      asPlan([
        { kind: "create-room", localId: "a", name: "Double", totalRooms: 3, maxGuests: 2 },
        { kind: "create-rate", localRoomId: "a", localPlanId: "std", label: "Double · Standard", occupancy: 2 },
      ]),
      ctx, api, w,
    );
    expect(out).toMatchObject({ createdRooms: 1, createdRates: 1, ok: true });
    const body = api.mock.calls.find((c) => c[1] === "/rate_plans")![2] as any;
    expect(body.rate_plan.room_type_id).toBe("cx-room");
    expect(body.rate_plan.options[0]).toMatchObject({ occupancy: 2, is_primary: true });
    expect(w.writeRateMapping).toHaveBeenCalledWith("ch1", "t1", "std", "a", "cx-rate");
  });
});

describe("adopting what Channex already has", () => {
  it("writes the mapping and sends NOTHING", async () => {
    // Adopting exists to prevent a duplicate. If it POSTed, it would create the very thing it is for.
    const api = okApi();
    const w = writes();
    const out = await applyStructurePlan(
      asPlan([{ kind: "adopt-room", localId: "suite", name: "Suite", channexId: "cx-existing" }]),
      ctx, api, w,
    );
    expect(api).not.toHaveBeenCalled();
    expect(w.writeRoomMapping).toHaveBeenCalledWith("ch1", "t1", "suite", "cx-existing");
    expect(out).toMatchObject({ adopted: 1, createdRooms: 0, ok: true });
  });

  it("an adopted room still gives its new rate plans the right room id", async () => {
    const api = okApi("cx-rate");
    const w = writes();
    await applyStructurePlan(
      asPlan([
        { kind: "adopt-room", localId: "a", name: "Double", channexId: "cx-adopted" },
        { kind: "create-rate", localRoomId: "a", localPlanId: "std", label: "Double · Standard", occupancy: 2 },
      ]),
      ctx, api, w,
    );
    const body = api.mock.calls.find((c) => c[1] === "/rate_plans")![2] as any;
    expect(body.rate_plan.room_type_id).toBe("cx-adopted");
  });
});

describe("one refusal must not abandon the rest", () => {
  it("keeps going and reports the failure by name", async () => {
    const api = vi.fn(async (_m: string, _p: string, body?: any) => {
      if (body?.room_type?.title === "Bad") throw new Error("Channex refused (422): title taken");
      return { data: { id: "cx-ok" } };
    });
    const out = await applyStructurePlan(
      asPlan([
        { kind: "create-room", localId: "bad", name: "Bad", totalRooms: 1, maxGuests: 2 },
        { kind: "create-room", localId: "good", name: "Good", totalRooms: 1, maxGuests: 2 },
      ]),
      ctx, api, writes(),
    );
    expect(out.createdRooms).toBe(1);
    expect(out.failures).toEqual([{ label: "Bad", error: "Channex refused (422): title taken" }]);
    expect(out.ok).toBe(false);
  });

  it("a room type that failed SKIPS its own rate plans rather than misattaching them", async () => {
    // A Channex rate plan hangs off a room type id. Attempting it without one would either error
    // confusingly or attach a price to the wrong room.
    const api = vi.fn(async (_m: string, path: string, _b?: unknown) => {
      if (path === "/room_types") throw new Error("nope");
      return { data: { id: "cx-rate" } };
    });
    const w = writes();
    const out = await applyStructurePlan(
      asPlan([
        { kind: "create-room", localId: "a", name: "Double", totalRooms: 1, maxGuests: 2 },
        { kind: "create-rate", localRoomId: "a", localPlanId: "std", label: "Double · Standard", occupancy: 2 },
      ]),
      ctx, api, w,
    );
    expect(w.writeRateMapping).not.toHaveBeenCalled();
    expect(out.skipped).toEqual([{ label: "Double · Standard", reason: "its room type could not be sent" }]);
    expect(out.ok).toBe(false);
  });

  it("a failed mapping write counts as a failure, not a success", async () => {
    const w = writes();
    w.writeRoomMapping = vi.fn(async () => { throw new Error("db down"); });
    const out = await applyStructurePlan(
      asPlan([{ kind: "create-room", localId: "a", name: "Double", totalRooms: 1, maxGuests: 2 }]),
      ctx, okApi(), w,
    );
    expect(out).toMatchObject({ createdRooms: 0, ok: false });
    expect(out.failures[0]!.error).toMatch(/db down/);
  });
});

describe("what it says afterwards", () => {
  it("a partial repair is not reported as a success", async () => {
    const s = describeStructureOutcome({
      createdRooms: 2, createdRates: 0, adopted: 1,
      failures: [{ label: "Suite", error: "x" }], skipped: [], ok: false,
    });
    expect(s).toMatch(/1 failed/);
    expect(s).toMatch(/still invisible to your OTAs/);
  });

  it("says plainly when everything landed", () => {
    const s = describeStructureOutcome({
      createdRooms: 1, createdRates: 2, adopted: 0, failures: [], skipped: [], ok: true,
    });
    expect(s).toBe("Sent to your channel manager — created 3.");
  });
});
