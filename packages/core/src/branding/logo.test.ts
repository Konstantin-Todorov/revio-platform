import { describe, expect, it } from "vitest";
import { brandLogoPath, resolveBrandLogo } from "./logo.js";

/**
 * These cases are the bug, written down.
 *
 * A hotel uploaded a logo for its guest emails. Uploading clears the pasted-URL column by design, so
 * the booking-engine screen — which read only that column — showed an empty field, and the live
 * booking page rendered a broken image. Both surfaces had the logo available the whole time and
 * neither knew how to ask for it.
 */
describe("resolveBrandLogo", () => {
  const P = "prop_1";

  it("finds an UPLOADED email logo even though the pasted-URL column is empty", () => {
    // Exactly the production state that broke: emailLogoUrl null, bytes in BrandAsset.
    expect(
      resolveBrandLogo(P, { prefer: "booking", uploaded: [{ kind: "email", version: 42 }], pastedUrl: null }),
    ).toBe("/api/brand/prop_1/logo?kind=email&v=42");
  });

  it("prefers the booking page's own logo over the inherited email one", () => {
    expect(
      resolveBrandLogo(P, {
        prefer: "booking",
        uploaded: [{ kind: "email", version: 1 }, { kind: "booking", version: 2 }],
        pastedUrl: null,
      }),
    ).toBe("/api/brand/prop_1/logo?kind=booking&v=2");
  });

  it("never inherits the booking logo into email — that inheritance runs one way only", () => {
    expect(
      resolveBrandLogo(P, { prefer: "email", uploaded: [{ kind: "booking", version: 9 }], pastedUrl: null }),
    ).toBeNull();
  });

  it("lets an upload outrank a stale pasted URL", () => {
    expect(
      resolveBrandLogo(P, {
        prefer: "booking",
        uploaded: [{ kind: "booking", version: 7 }],
        pastedUrl: "https://old.example.com/logo.png",
      }),
    ).toBe("/api/brand/prop_1/logo?kind=booking&v=7");
  });

  it("falls back to a pasted URL when nothing was uploaded", () => {
    expect(
      resolveBrandLogo(P, { prefer: "booking", uploaded: [], pastedUrl: "https://hotel.example/logo.png" }),
    ).toBe("https://hotel.example/logo.png");
  });

  it("treats a blank pasted URL as no logo, so the page shows the hotel's name instead", () => {
    expect(resolveBrandLogo(P, { prefer: "booking", uploaded: [], pastedUrl: "   " })).toBeNull();
    expect(resolveBrandLogo(P, { prefer: "booking", uploaded: [] })).toBeNull();
  });
});

describe("brandLogoPath", () => {
  it("stays relative, so each app serves the bytes itself and no origin variable can be forgotten", () => {
    expect(brandLogoPath("p", { kind: "email", version: 1 }).startsWith("/api/")).toBe(true);
  });

  it("carries a version, so replacing a logo is never masked by a cache", () => {
    const a = brandLogoPath("p", { kind: "booking", version: 1 });
    const b = brandLogoPath("p", { kind: "booking", version: 2 });
    expect(a).not.toBe(b);
  });

  it("escapes the version rather than trusting it to be URL-safe", () => {
    expect(brandLogoPath("p", { kind: "email", version: "a b&c" })).toContain("v=a%20b%26c");
  });
});
