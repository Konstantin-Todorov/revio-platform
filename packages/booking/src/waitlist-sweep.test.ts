import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * The sweep is the highest-consequence code in the waitlist feature: it places real `Hold`s, which
 * take rooms off sale, and it decides which guest gets an email saying a room is theirs. Its own
 * docstring states four rules that nothing verified until this file existed — expiries before
 * offers, hold before mark, one offer per freed room, and silence when the room went in the gap.
 *
 * The engine is mocked rather than the database, because the invariants under test are about
 * ORDER and about which write happens after which read. A `log` array records every interaction in
 * sequence, so "expiries are processed before offers" is asserted as a fact about the run rather
 * than inferred from the result counts.
 */

const mocks = vi.hoisted(() => ({
  log: [] as string[],
  publicAvailability: vi.fn(),
  publicCreateHold: vi.fn(),
  publicReleaseHold: vi.fn(),
}));

vi.mock("./public-engine.js", () => ({
  publicAvailability: mocks.publicAvailability,
  publicCreateHold: mocks.publicCreateHold,
  publicReleaseHold: mocks.publicReleaseHold,
}));

const { waitlistSweep } = await import("./waitlist-sweep.js");

const PROPERTY = {
  id: "prop_1",
  tenantId: "tenant_1",
  name: "Test Hotel",
  baseCurrency: "EUR",
  timezone: "Europe/Sofia",
};

/** Far enough out that the property's real "today" can never make these stale. */
const IN = new Date("2099-05-01T00:00:00.000Z");
const OUT = new Date("2099-05-03T00:00:00.000Z");
const NOW = new Date("2099-01-01T10:00:00.000Z");

interface EntryRow {
  id: string;
  guestName: string;
  guestEmail: string;
  locale: string | null;
  roomTypeId: string | null;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  status: string;
  createdAt: Date;
  offerCount: number;
  offerExpiresAt: Date | null;
  offerHoldId: string | null;
}

let seq = 0;
function entry(over: Partial<EntryRow> = {}): EntryRow {
  seq += 1;
  return {
    id: `e${seq}`,
    guestName: `Guest ${seq}`,
    guestEmail: `guest${seq}@example.com`,
    locale: "en",
    roomTypeId: null,
    checkIn: IN,
    checkOut: OUT,
    guests: 2,
    status: "waiting",
    createdAt: new Date(`2098-01-0${seq}T00:00:00.000Z`),
    offerCount: 0,
    offerExpiresAt: null,
    offerHoldId: null,
    ...over,
  };
}

function makeDb(rows: EntryRow[]) {
  const entryUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const holdUpdates: { id: string; data: Record<string, unknown> }[] = [];

  const db = {
    waitlistEntry: {
      findMany: async (args: {
        where: { status: string; offerExpiresAt?: { lte: Date } };
      }) => {
        const status = args.where.status;
        mocks.log.push(`read:${status}`);
        let out = rows.filter((r) => r.status === status);
        const lte = args.where.offerExpiresAt?.lte;
        if (lte) {
          out = out.filter((r) => r.offerExpiresAt != null && r.offerExpiresAt.getTime() <= lte.getTime());
        }
        // The real query orders by createdAt asc; the fake must too, or a test could pass here and
        // fail against Postgres.
        return [...out]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((r) => ({ ...r }));
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === args.where.id);
        if (!row) throw new Error(`no such entry ${args.where.id}`);
        mocks.log.push(`entry:${row.id}:${String(args.data["status"] ?? "patch")}`);
        entryUpdates.push({ id: args.where.id, data: args.data });
        for (const [k, v] of Object.entries(args.data)) {
          if (v && typeof v === "object" && "increment" in (v as Record<string, unknown>)) {
            const inc = (v as { increment: number }).increment;
            (row as unknown as Record<string, unknown>)[k] = (Number((row as unknown as Record<string, unknown>)[k]) || 0) + inc;
          } else {
            (row as unknown as Record<string, unknown>)[k] = v;
          }
        }
        return row;
      },
    },
    hold: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        mocks.log.push(`holdUpdate:${args.where.id}`);
        holdUpdates.push({ id: args.where.id, data: args.data });
        return {};
      },
    },
  };

  return { db: db as never, entryUpdates, holdUpdates, rows };
}

/** One sellable room type, shaped like `publicAvailability`'s option rows. */
function option(over: Partial<{ roomTypeId: string; maxGuests: number; remaining: number }> = {}) {
  return { roomTypeId: "rt_std", maxGuests: 4, remaining: 1, ...over };
}

let holdSeq = 0;

beforeEach(() => {
  mocks.log.length = 0;
  seq = 0;
  holdSeq = 0;
  mocks.publicAvailability.mockReset();
  mocks.publicCreateHold.mockReset();
  mocks.publicReleaseHold.mockReset();

  mocks.publicAvailability.mockImplementation(async (_db: unknown, _p: unknown, q: { checkIn: string }) => {
    mocks.log.push(`availability:${q.checkIn}`);
    return { options: [option()] };
  });
  mocks.publicCreateHold.mockImplementation(async () => {
    holdSeq += 1;
    const id = `hold_new_${holdSeq}`;
    mocks.log.push(`createHold:${id}`);
    return { hold: { id } };
  });
  mocks.publicReleaseHold.mockImplementation(async (_db: unknown, _pid: string, holdId: string) => {
    mocks.log.push(`release:${holdId}`);
  });
});

const before = (a: string, b: string) => mocks.log.indexOf(a) < mocks.log.indexOf(b);

describe("waitlistSweep — lapsed offers", () => {
  it("returns a lapsed entry to `waiting`, not `expired`", async () => {
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db, entryUpdates } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsed).toBe(1);
    expect(entryUpdates[0]?.data["status"]).toBe("waiting");
  });

  it("releases the hold behind a lapsed offer and clears every trace of it", async () => {
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db, entryUpdates } = makeDb([e]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(mocks.publicReleaseHold).toHaveBeenCalledWith(expect.anything(), PROPERTY.id, "hold_old");
    const data = entryUpdates[0]!.data;
    // A stale claim token is a live link to a room somebody else may now hold.
    expect(data["claimToken"]).toBeNull();
    expect(data["offerHoldId"]).toBeNull();
    expect(data["offerExpiresAt"]).toBeNull();
  });

  it("does not decrement offerCount, so three lapses end the entry's offers", async () => {
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db, entryUpdates } = makeDb([e]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(entryUpdates[0]!.data).not.toHaveProperty("offerCount");
    expect(e.offerCount).toBe(1);
  });

  it("does not hand the freed room straight back to the guest who ignored it", async () => {
    // The lapse write commits before the `waiting` read, so without a guard the lapsed entry is the
    // oldest waiting one and wins its own room back — three offers inside a few minutes, and the
    // person behind them never hears anything.
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsed).toBe(1);
    expect(res.offered).toBe(0);
    expect(e.offerCount).toBe(1);
    // Still waiting, still in queue order — they are eligible again on the next run.
    expect(e.status).toBe("waiting");
  });

  it("reports the lapsed guest so the caller can say `still on the list`", async () => {
    const e = entry({
      status: "offered",
      guestName: "Ada",
      guestEmail: "ada@example.com",
      locale: "bg",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsedEntries).toEqual([
      { entryId: e.id, guestName: "Ada", guestEmail: "ada@example.com", locale: "bg" },
    ]);
  });

  it("one stuck hold does not freeze the queue", async () => {
    mocks.publicReleaseHold.mockRejectedValue(new Error("channex down"));
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const { db } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsed).toBe(1);
  });

  it("leaves an offer that has not run out alone", async () => {
    const e = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
      offerHoldId: "hold_old",
    });
    const { db } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsed).toBe(0);
    expect(mocks.publicReleaseHold).not.toHaveBeenCalled();
  });
});

describe("waitlistSweep — ordering", () => {
  it("processes expiries before it reads availability", async () => {
    const lapsing = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const waiting = entry();
    const { db } = makeDb([lapsing, waiting]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(before("release:hold_old", "availability:2099-05-01")).toBe(true);
    expect(before(`entry:${lapsing.id}:waiting`, "availability:2099-05-01")).toBe(true);
  });

  it("offers the room a lapse just freed, in the same run", async () => {
    // Availability answers honestly: nothing is sellable until the stuck hold is released. If the
    // sweep read availability first, this run would offer nobody and the room would sit idle until
    // the next tick.
    mocks.publicAvailability.mockImplementation(async (_db: unknown, _p: unknown, q: { checkIn: string }) => {
      mocks.log.push(`availability:${q.checkIn}`);
      if (!mocks.log.includes("release:hold_old")) return { options: [] };
      return { options: [option()] };
    });

    const lapsing = entry({
      status: "offered",
      offerCount: 1,
      offerExpiresAt: new Date(NOW.getTime() - 60_000),
      offerHoldId: "hold_old",
    });
    const next = entry();
    const { db } = makeDb([lapsing, next]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.lapsed).toBe(1);
    expect(res.offered).toBe(1);
    expect(res.offers[0]?.entryId).toBe(next.id);
  });

  it("creates the hold before marking the entry offered", async () => {
    const e = entry();
    const { db } = makeDb([e]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    // The reverse order would email a guest about a room that was never reserved.
    expect(before("createHold:hold_new_1", `entry:${e.id}:offered`)).toBe(true);
  });
});

describe("waitlistSweep — stale entries", () => {
  it("expires an entry whose arrival date has passed and never offers it", async () => {
    const stale = entry({
      checkIn: new Date("2000-01-01T00:00:00.000Z"),
      checkOut: new Date("2000-01-03T00:00:00.000Z"),
    });
    const { db, entryUpdates } = makeDb([stale]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.staled).toBe(1);
    expect(res.offered).toBe(0);
    expect(entryUpdates[0]).toEqual({ id: stale.id, data: { status: "expired" } });
    expect(mocks.publicAvailability).not.toHaveBeenCalled();
  });

  it("does not read availability when every entry is stale or absent", async () => {
    const { db } = makeDb([]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res).toEqual({ offered: 0, lapsed: 0, staled: 0, offers: [], lapsedEntries: [] });
    expect(mocks.publicAvailability).not.toHaveBeenCalled();
  });
});

describe("waitlistSweep — offers", () => {
  it("holds the room, stamps the offer and reports what the email needs", async () => {
    const e = entry({ guestName: "Bo", guestEmail: "bo@example.com", locale: "bg" });
    const { db, entryUpdates, holdUpdates } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW, ttlMinutes: 60 });

    const deadline = new Date(NOW.getTime() + 60 * 60_000);
    expect(res.offered).toBe(1);
    expect(res.offers[0]).toMatchObject({
      entryId: e.id,
      guestName: "Bo",
      guestEmail: "bo@example.com",
      locale: "bg",
      roomTypeId: "rt_std",
      checkIn: "2099-05-01",
      checkOut: "2099-05-03",
      expiresAt: deadline,
    });
    expect(res.offers[0]!.claimToken).toMatch(/^[0-9a-f-]{36}$/);

    const write = entryUpdates.find((u) => u.id === e.id)!.data;
    expect(write["status"]).toBe("offered");
    expect(write["offerHoldId"]).toBe("hold_new_1");
    expect(write["offerCount"]).toEqual({ increment: 1 });
    // The token in the email must be the token in the row, or the link opens nothing.
    expect(write["claimToken"]).toBe(res.offers[0]!.claimToken);
    expect(holdUpdates).toEqual([{ id: "hold_new_1", data: { expiresAt: deadline } }]);
  });

  it("stretches the hold to outlive the offer, never the other way round", async () => {
    const e = entry();
    const { db, holdUpdates } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    // publicCreateHold stamps the booking engine's short TTL; left alone the room returns to sale
    // while the guest still holds a message saying it is theirs.
    expect(holdUpdates[0]!.data["expiresAt"]).toEqual(res.offers[0]!.expiresAt);
    expect((res.offers[0]!.expiresAt).getTime()).toBeGreaterThan(NOW.getTime() + 3 * 60 * 60_000);
  });

  it("says nothing when the room goes between the availability read and the hold", async () => {
    mocks.publicCreateHold.mockResolvedValue({ error: "That room has just been taken." });
    const e = entry();
    const { db, entryUpdates } = makeDb([e]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
    expect(res.offers).toEqual([]);
    expect(entryUpdates).toEqual([]);
  });

  it("makes one offer per freed room, not one per waiting guest", async () => {
    mocks.publicAvailability.mockResolvedValue({ options: [option({ remaining: 2 })] });
    const first = entry();
    const second = entry();
    const { db } = makeDb([first, second]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    // `remaining: 2` is two rooms, but one option is one offer this sweep: the second room is
    // offered on the next run, against availability that is actually current.
    expect(res.offered).toBe(1);
    expect(res.offers[0]?.entryId).toBe(first.id);
  });

  it("offers the oldest waiting entry first", async () => {
    const younger = entry({ createdAt: new Date("2098-06-01T00:00:00.000Z") });
    const older = entry({ createdAt: new Date("2098-01-01T00:00:00.000Z") });
    const { db } = makeDb([younger, older]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offers[0]?.entryId).toBe(older.id);
  });

  it("gives two freed room types to two different guests", async () => {
    mocks.publicAvailability.mockResolvedValue({
      options: [option({ roomTypeId: "rt_std" }), option({ roomTypeId: "rt_deluxe" })],
    });
    const first = entry({ createdAt: new Date("2098-01-01T00:00:00.000Z") });
    const second = entry({ createdAt: new Date("2098-02-01T00:00:00.000Z") });
    const { db } = makeDb([first, second]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(2);
    expect(res.offers.map((o) => o.entryId)).toEqual([first.id, second.id]);
    expect(res.offers.map((o) => o.roomTypeId)).toEqual(["rt_std", "rt_deluxe"]);
  });

  it("never offers the same entry twice in one run", async () => {
    mocks.publicAvailability.mockResolvedValue({
      options: [option({ roomTypeId: "rt_std" }), option({ roomTypeId: "rt_deluxe" })],
    });
    const only = entry();
    const { db } = makeDb([only]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(1);
    expect(mocks.publicCreateHold).toHaveBeenCalledTimes(1);
  });

  it("skips an option with nothing left", async () => {
    mocks.publicAvailability.mockResolvedValue({ options: [option({ remaining: 0 })] });
    const { db } = makeDb([entry()]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
    expect(mocks.publicCreateHold).not.toHaveBeenCalled();
  });

  it("respects an entry that asked for one specific room type", async () => {
    mocks.publicAvailability.mockResolvedValue({ options: [option({ roomTypeId: "rt_std" })] });
    const { db } = makeDb([entry({ roomTypeId: "rt_deluxe" })]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
  });

  it("does not offer a room that cannot hold the party", async () => {
    mocks.publicAvailability.mockResolvedValue({ options: [option({ maxGuests: 2 })] });
    const { db } = makeDb([entry({ guests: 4 })]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
  });

  it("stops writing to a guest who has let three offers lapse", async () => {
    const { db } = makeDb([entry({ offerCount: 3 })]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
  });

  it("stays silent when availability itself failed", async () => {
    mocks.publicAvailability.mockResolvedValue({ error: "Something went wrong." });
    const { db } = makeDb([entry()]);

    const res = await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(res.offered).toBe(0);
    expect(mocks.publicCreateHold).not.toHaveBeenCalled();
  });
});

describe("waitlistSweep — batching", () => {
  it("reads availability once per distinct stay window, not once per entry", async () => {
    const a = entry();
    const b = entry();
    const c = entry({
      checkIn: new Date("2099-07-01T00:00:00.000Z"),
      checkOut: new Date("2099-07-04T00:00:00.000Z"),
    });
    const { db } = makeDb([a, b, c]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(mocks.publicAvailability).toHaveBeenCalledTimes(2);
  });

  it("treats a different party size as a different window", async () => {
    const { db } = makeDb([entry({ guests: 2 }), entry({ guests: 3 })]);

    await waitlistSweep(db, PROPERTY, { now: NOW });

    expect(mocks.publicAvailability).toHaveBeenCalledTimes(2);
    const sizes = mocks.publicAvailability.mock.calls.map((c) => (c[2] as { guests: number }).guests);
    expect(sizes.sort()).toEqual([2, 3]);
  });
});
