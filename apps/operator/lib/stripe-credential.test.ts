import { describe, expect, it } from "vitest";
import { readStoredSecret } from "./stripe-credential";

describe("stored Stripe credential state", () => {
  it("keeps not configured distinct from a broken encryption envelope", () => {
    expect(readStoredSecret(null, () => "unused")).toEqual({ state: "missing" });
    expect(readStoredSecret("cipher", () => { throw new Error("wrong key"); }))
      .toEqual({ state: "decryption_error" });
  });

  it("returns plaintext only to the narrow server-side caller", () => {
    expect(readStoredSecret("cipher", (value) => `${value}-plain`))
      .toEqual({ state: "ready", secret: "cipher-plain" });
  });
});
