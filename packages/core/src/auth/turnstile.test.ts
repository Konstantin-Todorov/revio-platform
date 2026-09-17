import { describe, expect, it } from "vitest";

import { readTurnstileResult, turnstileNotConfigured } from "./turnstile";

describe("readTurnstileResult", () => {
  it("passes a solved challenge", () => {
    expect(readTurnstileResult(200, { success: true })).toEqual({ ok: true, reason: "passed", unverified: false });
  });

  it("refuses a failed one, and keeps the codes for the log", () => {
    const v = readTurnstileResult(200, { success: false, "error-codes": ["invalid-input-response"] });
    expect(v.ok).toBe(false);
    expect(v.unverified).toBe(false);
    expect(v.reason).toContain("invalid-input-response");
  });

  it("⚠️ status code first — an error body is valid JSON with no `success` field", () => {
    // Reading `json.success` alone cannot tell a failed challenge from an outage: both are falsy.
    // That exact confusion produced 411 consecutive "success" sync events on a revoked Channex key.
    const outage = readTurnstileResult(502, null);
    expect(outage.ok).toBe(true);
    expect(outage.unverified).toBe(true);
    expect(outage.reason).toContain("502");
  });

  it("⚠️ never blocks a hotel because OUR secret is wrong", () => {
    // A mistyped secret would otherwise mean "no hotel can sign up", discovered by a customer who
    // gives up silently. Allow, and make the log name the cause.
    for (const code of ["invalid-input-secret", "missing-input-secret"]) {
      const v = readTurnstileResult(200, { success: false, "error-codes": [code] });
      expect(v.ok, code).toBe(true);
      expect(v.unverified, code).toBe(true);
      expect(v.reason).toContain(code);
    }
  });

  it("allows when nothing is configured, and says so", () => {
    const v = turnstileNotConfigured();
    expect(v.ok).toBe(true);
    expect(v.unverified).toBe(true);
  });

  it("every permissive verdict is marked unverified, so a run of them is visible", () => {
    // The whole safety of failing open is that it cannot be silent.
    const permissive = [
      readTurnstileResult(500, null),
      readTurnstileResult(200, { success: false, "error-codes": ["missing-input-secret"] }),
      turnstileNotConfigured(),
    ];
    expect(permissive.every((v) => v.ok && v.unverified)).toBe(true);
    // ...and a genuine pass is NOT marked unverified, or the signal would be meaningless.
    expect(readTurnstileResult(200, { success: true }).unverified).toBe(false);
  });
});
