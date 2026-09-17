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
