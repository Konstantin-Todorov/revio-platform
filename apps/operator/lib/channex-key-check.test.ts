import { describe, it, expect, vi, afterEach } from "vitest";
import { checkChannexKey } from "./channex-key-check";

/**
 * The one distinction this codebase keeps getting wrong.
 *
 * An unauthenticated Channex request answers **401 with no `data` key**, so any check written as
 * `body.data?.length ?? 0` reports "zero properties" for a dead key and for an empty account alike.
 * That has now caused three separate incidents, the last of which left the first real hotel's
 * channel silently doing nothing for hours — and I made the same mistake again while diagnosing it.
 *
 * These tests exist so the check can never quietly go back to reading the array.
 */

function respondWith(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe("checkChannexKey", () => {
  it("reports a 401 as REJECTED, not as an empty account", () => {
    respondWith(401, { type: "unauthorized" });
    return expect(checkChannexKey("dead", "channex_prod")).resolves.toMatchObject({
      ok: false, status: 401, properties: null,
    });
  });

  it("says a rejected key may belong to a different account — the non-obvious cause", async () => {
    respondWith(401, { type: "unauthorized" });
    const r = await checkChannexKey("dead", "channex_prod");
    expect(r.message).toMatch(/revoked|regenerated|different account/i);
  });

  it("treats 403 as rejected too", async () => {
    respondWith(403, {});
    expect((await checkChannexKey("k", "channex_prod")).ok).toBe(false);
  });

  it("distinguishes a WORKING key with zero properties from a dead one", async () => {
    // Both read as "0" if you count the array. Only one of them can be fixed by provisioning.
    respondWith(200, { data: [] });
    const r = await checkChannexKey("live", "channex_prod");
    expect(r.ok).toBe(true);
    expect(r.properties).toBe(0);
  });

  it("counts the properties a working key can see", async () => {
    respondWith(200, { data: [{ id: "a" }, { id: "b" }] });
    const r = await checkChannexKey("live", "channex_prod");
    expect(r).toMatchObject({ ok: true, properties: 2 });
    expect(r.message).toContain("2 properties");
  });

  it("says 'property' singular for one", async () => {
    respondWith(200, { data: [{ id: "a" }] });
    expect((await checkChannexKey("live", "channex_prod")).message).toContain("1 property");
  });

  it("reports a 5xx as a failure rather than as no properties", async () => {
    respondWith(503, {});
    expect((await checkChannexKey("k", "channex_prod")).ok).toBe(false);
  });

  it("survives a 200 whose body will not parse — it still authenticated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>hi</html>", { status: 200 })));
    const r = await checkChannexKey("k", "channex_prod");
    expect(r.ok).toBe(true);
    expect(r.properties).toBeNull();
  });

  it("reports a network failure as a failure, with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    expect(await checkChannexKey("k", "channex_prod")).toMatchObject({ ok: false, status: 0 });
  });

  it("uses app.channex.io for production — NOT secure.channex.io, which is not a Channex host", async () => {
    // The bug this whole file failed to catch: a hardcoded `secure.` host 401'd every request, so
    // the key checker reported a working production key as revoked. The host now comes from core.
    const spy = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await checkChannexKey("k", "channex_prod");
    expect(String(spy.mock.calls[0]?.[0])).toContain("app.channex.io");
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("secure.channex.io");
  });

  it("sends sandbox and production at DIFFERENT hosts — separate accounts, separate keys", async () => {
    const spy = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await checkChannexKey("k", "channex_prod");
    await checkChannexKey("k", "channex_sandbox");
    const urls = spy.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(2);
    expect(urls.join(" ")).toContain("app.channex.io");
    expect(urls.join(" ")).toContain("staging.channex.io");
  });

  it("refuses an unknown mode instead of guessing a host", async () => {
    expect((await checkChannexKey("k", "nonsense")).ok).toBe(false);
  });
});
