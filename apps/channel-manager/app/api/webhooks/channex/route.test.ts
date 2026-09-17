import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * This is the only unauthenticated write surface in the staff products, so what it REFUSES matters
 * more than what it does. The database and the pull are mocked: what is under test is the gate.
 */
const findMany = vi.fn(async (_args: { where: Record<string, unknown> }) => [{ id: "ch1" }]);
const pullChannel = vi.fn(async () => ({ ok: true }));

vi.mock("@revio/db", () => ({ forSystem: () => ({ channel: { findMany } }) }));
vi.mock("@revio/connectivity", () => ({ pullChannel, WEBHOOK_SECRET_HEADER: "x-revio-webhook" }));

const { POST } = await import("./route");

const ring = (headers: Record<string, string>, body: unknown = { property_id: "cx-prop" }) =>
  POST(new Request("https://cm.reviosoft.app/api/webhooks/channex", {
    method: "POST", headers, body: JSON.stringify(body),
  }) as never);

afterEach(() => { vi.clearAllMocks(); delete process.env.CHANNEX_WEBHOOK_SECRET; });

describe("the gate", () => {
  /*
   * ⚠️ FAIL CLOSED. An unset secret would otherwise mean every request on the internet is accepted,
   * and this route starts work against a real hotel's channel. The five-minute poll keeps bookings
   * arriving meanwhile, so refusing costs latency and nothing else.
   */
  it("refuses everything when no secret is configured", async () => {
    const res = await ring({ "x-revio-webhook": "anything" });
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    expect((await ring({ "x-revio-webhook": "wrong" })).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("refuses a missing header", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    expect((await ring({})).status).toBe(401);
  });

  /* The refusal says nothing about whether the property exists — an endpoint that answers
     differently for a real id is an enumeration oracle. */
  it("answers a bad secret identically for a real and an invented property", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    const a = await ring({ "x-revio-webhook": "no" }, { property_id: "cx-prop" });
    const b = await ring({ "x-revio-webhook": "no" }, { property_id: "made-up" });
    expect(await a.json()).toEqual(await b.json());
    expect(a.status).toBe(b.status);
  });
});

describe("what it does when it is really Channex", () => {
  it("pulls, and scopes to the property that rang", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    const res = await ring({ "x-revio-webhook": "right" });
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "connected",
          externalPropertyId: "cx-prop",
        }),
      }),
    );
  });

  /*
   * ⚠️ Even an unscoped ring can only reach channels that the five-minute cron was already polling.
   * A forged or malformed body cannot widen what this route touches.
   */
  it("still only ever touches connected, real channels when the body is unreadable", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    await POST(new Request("https://x/api/webhooks/channex", {
      method: "POST", headers: { "x-revio-webhook": "right" }, body: "not json",
    }) as never);
    const where = findMany.mock.calls[0]?.[0]?.where as Record<string, unknown> | undefined;
    expect(where).toMatchObject({ status: "connected", connectivityMode: { not: "mock" } });
    expect(where).not.toHaveProperty("externalPropertyId");
  });

  /* Channex disables an endpoint that answers slowly, so the ring is acknowledged before the pull. */
  it("answers without waiting for the pull", async () => {
    process.env.CHANNEX_WEBHOOK_SECRET = "right";
    let released = false;
    pullChannel.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 40));
      released = true;
      return { ok: true };
    });
    const res = await ring({ "x-revio-webhook": "right" });
    expect(res.status).toBe(200);
    expect(released).toBe(false);
  });
});
