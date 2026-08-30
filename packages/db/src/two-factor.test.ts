import { describe, it, expect, beforeEach } from "vitest";
import { totp, TOTP_PERIOD_SECONDS } from "@revio/core/server";
import { encryptSecret, decryptSecret } from "./crypto.js";
import {
  beginEnrolment, confirmEnrolment, verifySecond, disable, isEnabled,
  type TwoFactorStore,
} from "./two-factor.js";

/**
 * The store logic, against an in-memory table.
 *
 * `operator-2fa.ts` shipped with no tests of its own — the TOTP maths in `@revio/core` is covered,
 * but the part that decides whether a code is ACCEPTED was not, and that is where replay refusal and
 * the recovery-code rules live. Both are security properties and both are now pinned here, once, for
 * every account type that uses this module.
 */

interface Row {
  email: string;
  totpSecret: string | null;
  totpEnabledAt: Date | null;
  totpLastStep: number | null;
}

function fakeStore(): TwoFactorStore & { row: Row; codes: { id: string; codeHash: string; usedAt: Date | null }[] } {
  const state = {
    row: { email: "maria@hotel.test", totpSecret: null, totpEnabledAt: null, totpLastStep: null } as Row,
    codes: [] as { id: string; codeHash: string; usedAt: Date | null }[],
  };
  return {
    ...state,
    get row() { return state.row; },
    get codes() { return state.codes; },
    async read() { return state.row; },
    async write(_id, data) { Object.assign(state.row, data); },
    async listRecoveryCodes() { return state.codes; },
    async replaceRecoveryCodes(_id, hashes) {
      state.codes = hashes.map((codeHash, i) => ({ id: `c${i}`, codeHash, usedAt: null }));
    },
    async markRecoveryCodeUsed(codeId, at) {
      const c = state.codes.find((x) => x.id === codeId);
      if (c) c.usedAt = at;
    },
    async countUnusedRecoveryCodes() { return state.codes.filter((c) => !c.usedAt).length; },
  };
}

const AT = Date.UTC(2026, 7, 30, 12, 0, 0);
const codeAt = (secret: string, at: number) => totp(secret, at);

let store: ReturnType<typeof fakeStore>;
beforeEach(() => {
  store = fakeStore();
});

async function enrol(at = AT): Promise<string> {
  const offer = await beginEnrolment(store, "u1", "Revio");
  const ok = await confirmEnrolment(store, "u1", codeAt(offer.secret, at), at);
  expect(ok.ok).toBe(true);
  return offer.secret;
}

describe("enrolment", () => {
  it("stores the secret ENCRYPTED and leaves 2FA off until a code is proven", async () => {
    const offer = await beginEnrolment(store, "u1", "Revio");
    expect(store.row.totpSecret).not.toBeNull();
    // Never the raw base32 — a leaked row must not be a working authenticator.
    expect(store.row.totpSecret).not.toBe(offer.secret);
    expect(decryptSecret(store.row.totpSecret!)).toBe(offer.secret);
    // Stored, encrypted, inert.
    expect(store.row.totpEnabledAt).toBeNull();
    expect(await isEnabled(store, "u1")).toBe(false);
  });

  it("refuses to enable on a wrong code, so nobody is locked out by a bad scan", async () => {
    await beginEnrolment(store, "u1", "Revio");
    const r = await confirmEnrolment(store, "u1", "000000", AT);
    expect(r.ok).toBe(false);
    expect(store.row.totpEnabledAt).toBeNull();
  });

  it("issues recovery codes exactly once, hashed, never stored in the clear", async () => {
    const offer = await beginEnrolment(store, "u1", "Revio");
    const r = await confirmEnrolment(store, "u1", codeAt(offer.secret, AT), AT);
    expect(r.recoveryCodes!.length).toBeGreaterThan(0);
    for (const plain of r.recoveryCodes!) {
      expect(store.codes.some((c) => c.codeHash === plain)).toBe(false);
    }
    expect(store.codes).toHaveLength(r.recoveryCodes!.length);
  });

  it("re-enrolling invalidates the codes printed last time", async () => {
    await enrol();
    const first = [...store.codes];
    const offer = await beginEnrolment(store, "u1", "Revio");
    // …and turns 2FA back off until the new secret is proven.
    expect(store.row.totpEnabledAt).toBeNull();
    await confirmEnrolment(store, "u1", codeAt(offer.secret, AT), AT);
    expect(store.codes.map((c) => c.codeHash)).not.toEqual(first.map((c) => c.codeHash));
  });

  it("refuses a second enrolment while one is already active", async () => {
    const secret = await enrol();
    const r = await confirmEnrolment(store, "u1", codeAt(secret, AT), AT);
    expect(r).toMatchObject({ ok: false });
  });
});

describe("verifying a TOTP code", () => {
  it("accepts the current code", async () => {
    const secret = await enrol();
    const later = AT + 2 * TOTP_PERIOD_SECONDS * 1000;
    expect(await verifySecond(store, "u1", codeAt(secret, later), later)).toMatchObject({ ok: true });
  });

  it("REFUSES REPLAY — the same code twice", async () => {
    // The property this module exists to guarantee. A code stays mathematically valid for its whole
    // step, so without lastStep a code read over a shoulder works again.
    const secret = await enrol();
    const later = AT + 2 * TOTP_PERIOD_SECONDS * 1000;
    const code = codeAt(secret, later);
    expect(await verifySecond(store, "u1", code, later)).toMatchObject({ ok: true });
    const second = await verifySecond(store, "u1", code, later);
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toMatch(/already been used/i);
  });

  it("refuses the PREVIOUS step's code after the current one was accepted", async () => {
    // The accepted window spans three steps, so comparing against the current step alone would let
    // the previous step's code through a second time.
    const secret = await enrol();
    const t = AT + 5 * TOTP_PERIOD_SECONDS * 1000;
    await verifySecond(store, "u1", codeAt(secret, t), t);
    const prev = codeAt(secret, t - TOTP_PERIOD_SECONDS * 1000);
    expect((await verifySecond(store, "u1", prev, t)).ok).toBe(false);
  });

  it("rejects a wrong code", async () => {
    await enrol();
    expect((await verifySecond(store, "u1", "123456", AT)).ok).toBe(false);
  });

  it("refuses everything when 2FA is not enabled", async () => {
    expect((await verifySecond(store, "u1", "123456", AT)).ok).toBe(false);
  });
});

describe("recovery codes", () => {
  it("accepts one, and reports how many are left", async () => {
    const offer = await beginEnrolment(store, "u1", "Revio");
    const r = await confirmEnrolment(store, "u1", codeAt(offer.secret, AT), AT);
    const codes = r.recoveryCodes!;
    const used = await verifySecond(store, "u1", codes[0]!, AT);
    expect(used).toMatchObject({ ok: true, usedRecoveryCode: true });
    expect(used.ok === true && used.recoveryCodesRemaining).toBe(codes.length - 1);
  });

  it("refuses the SAME recovery code twice, and says it was used rather than wrong", async () => {
    // A different problem for the person holding the printed sheet, and it must be said out loud.
    const offer = await beginEnrolment(store, "u1", "Revio");
    const r = await confirmEnrolment(store, "u1", codeAt(offer.secret, AT), AT);
    const one = r.recoveryCodes![0]!;
    await verifySecond(store, "u1", one, AT);
    const again = await verifySecond(store, "u1", one, AT);
    expect(again.ok).toBe(false);
    expect(again.ok === false && again.error).toMatch(/already been used/i);
  });

  it("accepts a recovery code however the person typed it", async () => {
    const offer = await beginEnrolment(store, "u1", "Revio");
    const r = await confirmEnrolment(store, "u1", codeAt(offer.secret, AT), AT);
    const messy = ` ${r.recoveryCodes![1]!.toLowerCase()} `;
    expect((await verifySecond(store, "u1", messy, AT)).ok).toBe(true);
  });
});

describe("disable", () => {
  it("clears the secret and every recovery code", async () => {
    await enrol();
    await disable(store, "u1");
    expect(store.row.totpSecret).toBeNull();
    expect(store.row.totpEnabledAt).toBeNull();
    expect(store.row.totpLastStep).toBeNull();
    expect(store.codes).toHaveLength(0);
    expect(await isEnabled(store, "u1")).toBe(false);
  });
});

describe("crypto round-trip", () => {
  it("encrypts differently each time but decrypts to the same secret", async () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP");
    const b = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });
});
