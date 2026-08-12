import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  checkSessionValidity,
  sessionTtlSeconds,
} from "./session-validity.js";

const secs = (d: Date) => Math.floor(d.getTime() / 1000);
const NOW = new Date("2026-08-12T10:00:00.000Z");
const iat = secs(NOW);

describe("an account that has never revoked anything", () => {
  it("accepts its token", () => {
    expect(checkSessionValidity({ issuedAt: iat, sessionsValidFrom: null, active: true })).toEqual({ ok: true });
  });

  it("accepts it even with no issued-at, because nothing is being compared", () => {
    // Only a cutoff makes `iat` load-bearing. Demanding it unconditionally would sign out every
    // session in existence the day this shipped.
    expect(checkSessionValidity({ issuedAt: undefined, sessionsValidFrom: null, active: true })).toEqual({ ok: true });
  });
});

describe("deactivation", () => {
  it("beats everything else — an inactive account is out, however fresh the token", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(checkSessionValidity({ issuedAt: secs(future), sessionsValidFrom: null, active: false })).toEqual({
      ok: false,
      reason: "deactivated",
    });
  });

  it("is reported as deactivation, not revocation, so a screen can say which", () => {
    const v = checkSessionValidity({ issuedAt: iat, sessionsValidFrom: NOW, active: false });
    expect(v).toEqual({ ok: false, reason: "deactivated" });
  });
});

describe("revocation", () => {
  it("kills a token minted before the cutoff", () => {
    const cutoff = new Date(NOW.getTime() + 1_000);
    expect(checkSessionValidity({ issuedAt: iat, sessionsValidFrom: cutoff, active: true })).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("keeps a token minted after it", () => {
    const cutoff = new Date(NOW.getTime() - 60_000);
    expect(checkSessionValidity({ issuedAt: iat, sessionsValidFrom: cutoff, active: true })).toEqual({ ok: true });
  });

  it("KEEPS a token minted in the same second as the cutoff", () => {
    // The device someone just used to change their password must not be signed out by that change.
    // `iat` is whole seconds and the cutoff has milliseconds, so a strict > would do exactly that.
    const cutoff = new Date(NOW.getTime() + 400); // same second, later millisecond
    expect(checkSessionValidity({ issuedAt: iat, sessionsValidFrom: cutoff, active: true })).toEqual({ ok: true });
  });

  it("fails closed when a cutoff exists and the token has no issued-at", () => {
    // Every token we mint carries iat. One that does not is not ours, and "no timestamp" must never
    // be a way to escape a revocation.
    expect(checkSessionValidity({ issuedAt: undefined, sessionsValidFrom: NOW, active: true })).toEqual({
      ok: false,
      reason: "no-issued-at",
    });
    expect(checkSessionValidity({ issuedAt: Number.NaN, sessionsValidFrom: NOW, active: true })).toEqual({
      ok: false,
      reason: "no-issued-at",
    });
  });

  it("revokes every older session at once — that is the point of one line in time", () => {
    const cutoff = new Date(NOW.getTime());
    const sessions = [-86400, -3600, -60, -1].map((d) => iat + d);
    for (const s of sessions) {
      expect(checkSessionValidity({ issuedAt: s, sessionsValidFrom: cutoff, active: true }).ok).toBe(false);
    }
  });
});

describe("how long a session lasts", () => {
  it("is shorter by default than when remembered", () => {
    expect(sessionTtlSeconds(false)).toBeLessThan(sessionTtlSeconds(true));
  });

  it("defaults to under a day — a front-desk terminal is shared", () => {
    expect(sessionTtlSeconds(false)).toBeLessThanOrEqual(60 * 60 * 24);
  });

  it("never remembers for longer than a fortnight", () => {
    expect(sessionTtlSeconds(true)).toBeLessThanOrEqual(60 * 60 * 24 * 14);
  });

  it("exposes both values so a screen can state them rather than guess", () => {
    expect(SESSION_TTL_SECONDS.short).toBe(sessionTtlSeconds(false));
    expect(SESSION_TTL_SECONDS.remembered).toBe(sessionTtlSeconds(true));
  });
});
