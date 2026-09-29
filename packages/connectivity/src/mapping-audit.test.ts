import { describe, expect, it, vi } from "vitest";
import { auditChannelMapping } from "./mapping-audit.js";

/**
 * The audit's job is to be RIGHT about what it accuses, because it raises a critical entry on a
 * hotel's screen and a flag on the console somebody reads before telephoning them. These pin the
 * three cases where the honest answer is "I do not know" rather than "everything is fine".
 */

vi.mock("./sync.js", () => ({
  listChannelProducts: vi.fn(),
  verifyChannelProperty: vi.fn(),
}));
vi.mock("./channex-webhook.js", () => ({ ensureChannexWebhook: vi.fn() }));
const sync = await import("./sync.js");
const webhook = await import("./channex-webhook.js");

const CHANNEL = { id: "ch1", name: "Channex", tenantId: "t1", propertyId: "p1" };

function db(over: Record<string, unknown> = {}) {
  return {
    channel: { findUnique: vi.fn(async () => CHANNEL), update: vi.fn(async () => ({})) },
    channelRatePlanMapping: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) },
    channelRoomTypeMapping: { findMany: vi.fn(async () => []) },
    errorItem: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    ...over,
  } as never;
}

describe("auditChannelMapping", () => {
  it("names a property the channel no longer has, instead of calling its catalogue empty", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: false, status: 404 });
    const create = vi.fn(async (_args: { data: { code: string } }) => ({}));
    const r = await auditChannelMapping(db({ errorItem: { findFirst: vi.fn(async () => null), create } }), "ch1");
    expect(r.skipped).toMatch(/404s the property/);
    expect(r.raised).toBe(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ data: { code: "channel_property_missing" } });
    // It must NOT have gone on to judge the mappings against a catalogue it could not read.
    expect(sync.listChannelProducts).not.toHaveBeenCalled();
  });

  /*
   * An unauthenticated Channex request is a 401 with no `data` key, and listChannelProducts swallows
   * it into an empty list. Writing that down would mark every mapping in the hotel as pointing at a
   * plan the channel does not have — one revoked key, a screen full of invented faults.
   */
  it("treats zero rate plans as no answer, not as an empty account", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(sync.listChannelProducts).mockResolvedValue({ rooms: [], rates: [] });
    const update = vi.fn(async () => ({}));
    const r = await auditChannelMapping(db({ channelRatePlanMapping: { findMany: vi.fn(async () => []), update } }), "ch1");
    expect(r.skipped).toMatch(/listed no rate plans/);
    expect(r.raised).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not raise a second entry while an open one already says it", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: false, status: 404 });
    const create = vi.fn(async () => ({}));
    const r = await auditChannelMapping(
      db({ errorItem: { findFirst: vi.fn(async () => ({ id: "e1" })), create } }),
      "ch1",
    );
    expect(create).not.toHaveBeenCalled();
    expect(r.raised).toBe(0);
  });
});

describe("closing what is no longer true", () => {
  /*
   * DesManagement, 2026-09-29: the wrong id was removed on 22 Sept and the entry saying prices were
   * going to the wrong room stayed open a week, read as a live fault. An audit that has just read the
   * catalogue and found no cross-wire must close it — and must leave a still-true one open.
   */
  it("closes a cross-wire entry once the channel no longer shows it, and keeps one that is still true", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(sync.listChannelProducts).mockResolvedValue({
      rooms: [{ id: "R1", name: "One bed" }, { id: "R2", name: "Two bed" }],
      rates: [{ id: "P1", name: "Flex 1", roomTypeId: "R1" }, { id: "P2", name: "Flex 2", roomTypeId: "R1" }],
    } as never);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const r = await auditChannelMapping(
      db({
        channelRatePlanMapping: {
          findMany: vi.fn(async () => [
            // Right: two-bed Flex was the fault, and is now correct…
            { id: "m1", externalRateId: "P1", roomTypeId: "rt1", roomType: { name: "Apartment 1" }, ratePlan: { name: "Flex" } },
            // …while this one still publishes a one-bed plan under the two-bed room.
            { id: "m2", externalRateId: "P2", roomTypeId: "rt2", roomType: { name: "Apartment 2" }, ratePlan: { name: "Flex" } },
          ]),
          update: vi.fn(async () => ({})),
        },
        channelRoomTypeMapping: {
          findMany: vi.fn(async () => [
            { roomTypeId: "rt1", externalRoomId: "R1", roomType: { name: "Apartment 1" } },
            { roomTypeId: "rt2", externalRoomId: "R2", roomType: { name: "Apartment 2" } },
          ]),
        },
        errorItem: {
          findFirst: vi.fn(async () => ({ id: "open-still-true" })),
          create: vi.fn(async () => ({})),
          findMany: vi.fn(async () => [
            { id: "stale", productLabel: "Apartment 2 · Standard Rate" },
            { id: "open-still-true", productLabel: "Apartment 2 · Flex" },
          ]),
          updateMany,
        },
      }),
      "ch1",
    );
    expect(r.crossWired.map((f) => `${f.roomTypeName} · ${f.ratePlanName}`)).toEqual(["Apartment 2 · Flex"]);
    expect(r.cleared).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ["stale"] } }, data: { resolved: true } });
  });
});

describe("keeping the webhook alive", () => {
  /*
   * ⚠️ Registered once and never checked is the defect shape this codebase keeps producing. A
   * webhook deleted on Channex's side, or never created because a connect half-failed, produces no
   * error anywhere — bookings just go back to arriving up to five minutes late, which nobody would
   * notice. So it is checked nightly, and it is never allowed to fail the audit.
   */
  it("is skipped entirely when no callback url or secret is configured", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(sync.listChannelProducts).mockResolvedValue({ rooms: [], rates: [] });
    const r = await auditChannelMapping(db(), "ch1");
    expect(r.webhook).toBeUndefined();
    expect(webhook.ensureChannexWebhook).not.toHaveBeenCalled();
  });

  it("reports what it did without disturbing the mapping check", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(sync.listChannelProducts).mockResolvedValue({ rooms: [], rates: [] });
    vi.mocked(webhook.ensureChannexWebhook).mockResolvedValue({ ok: true, unchanged: true });
    const r = await auditChannelMapping(db(), "ch1", "https://cm.reviosoft.app/api/webhooks/channex", "s3cret");
    expect(r.webhook).toBe("already");
    // The mapping verdict is unchanged by anything the webhook did.
    expect(r.skipped).toMatch(/listed no rate plans/);
  });

  it("says `failed` rather than throwing, because the poll still runs", async () => {
    vi.mocked(sync.verifyChannelProperty).mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(sync.listChannelProducts).mockResolvedValue({ rooms: [], rates: [] });
    vi.mocked(webhook.ensureChannexWebhook).mockResolvedValue({ ok: false, error: "nope" });
    expect((await auditChannelMapping(db(), "ch1", "u", "s")).webhook).toBe("failed");
  });
});
