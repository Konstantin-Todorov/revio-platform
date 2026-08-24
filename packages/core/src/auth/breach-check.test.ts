import { describe, it, expect, vi } from "vitest";
import { isBreachedPassword, breachMessage } from "./breach-check.js";

/** SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 → prefix 5BAA6, suffix 1E4C9B9… */
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

const respondWith = (body: string, ok = true) =>
  vi.fn(async () => ({ ok, text: async () => body })) as unknown as typeof fetch;

describe("isBreachedPassword", () => {
  it("only ever sends the first five hash characters", async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, text: async () => "" }));
    await isBreachedPassword("password", spy as unknown as typeof fetch);
    const url = new URL(String(spy.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    // The whole privacy claim, asserted on what we actually SEND rather than on the whole string —
    // the hostname is "pwnedpasswords.com", so a naive `not.toContain("password")` fails on the
    // domain and proves nothing either way.
    const sent = url.pathname.split("/").pop()!;
    expect(sent).toHaveLength(5);
    expect(sent).not.toContain(PASSWORD_SUFFIX);
    expect(url.search).toBe("");
  });

  it("reports a breached password with its count", async () => {
    const r = await isBreachedPassword("password", respondWith(`${PASSWORD_SUFFIX}:9659365`));
    expect(r.breached).toBe(true);
    expect(r.count).toBe(9659365);
  });

  it("reports a password absent from the bucket as clean", async () => {
    const r = await isBreachedPassword("password", respondWith("0000000000000000000000000000000000A:5"));
    expect(r.breached).toBe(false);
    expect(r.skipped).toBeUndefined();
  });

  it("ignores padding entries, which have a count of zero", async () => {
    // The API pads responses so their size reveals nothing; those rows are not real matches.
    const r = await isBreachedPassword("password", respondWith(`${PASSWORD_SUFFIX}:0`));
    expect(r.breached).toBe(false);
  });

  it("FAILS OPEN when the service errors", async () => {
    const r = await isBreachedPassword("password", respondWith("", false));
    expect(r).toEqual({ breached: false, skipped: true });
  });

  it("FAILS OPEN when the request throws", async () => {
    const boom = vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const r = await isBreachedPassword("password", boom);
    // An outage at a third party must never stop a hotel's new manager finishing their invitation.
    expect(r).toEqual({ breached: false, skipped: true });
  });

  it("asks for padding, so response size leaks nothing", async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, text: async () => "" }));
    await isBreachedPassword("hunter2", spy as unknown as typeof fetch);
    expect(spy.mock.calls[0]![1]?.headers).toMatchObject({ "Add-Padding": "true" });
  });
});

describe("breachMessage", () => {
  it("uses the count when there is one, so the warning carries weight", () => {
    expect(breachMessage(9659365)).toContain("9,659,365");
  });
  it("stays sensible without a count", () => {
    expect(breachMessage()).toContain("known data breach");
  });
});
