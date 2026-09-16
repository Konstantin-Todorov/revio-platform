import { describe, expect, it } from "vitest";

import { relativeLocation } from "./relative-redirect";

describe("relativeLocation", () => {
  it("returns the path unchanged when there is nothing to add", () => {
    expect(relativeLocation("/dashboard")).toBe("/dashboard");
    expect(relativeLocation("/login", {})).toBe("/login");
  });

  it("never produces an absolute URL — that is the whole point", () => {
    // Behind Railway's proxy an absolute URL is built from the INTERNAL host, so a hotel switching
    // products landed on localhost:3003. Every result here must be host-less.
    const results = [
      relativeLocation("/dashboard"),
      relativeLocation("/login", { error: "Too many attempts." }),
      relativeLocation("/no-access", { from: "pms" }),
    ];
    for (const r of results) {
      expect(r.startsWith("/")).toBe(true);
      expect(r.startsWith("//")).toBe(false);
      expect(() => new URL(r)).toThrow();
    }
  });

  it("encodes params rather than pasting them in", () => {
    expect(relativeLocation("/login", { error: "Wait a moment & sign in normally." })).toBe(
      "/login?error=Wait+a+moment+%26+sign+in+normally.",
    );
  });

  it("drops undefined and empty params instead of emitting a bare key", () => {
    expect(relativeLocation("/login", { error: undefined, email: "" })).toBe("/login");
    expect(relativeLocation("/login", { error: undefined, email: "a@b.com" })).toBe("/login?email=a%40b.com");
  });

  it("adds to an existing query string rather than replacing it", () => {
    expect(relativeLocation("/login?next=%2Ffolio", { error: "no" })).toBe("/login?next=%2Ffolio&error=no");
  });

  it("refuses a protocol-relative path, which a browser reads as a host", () => {
    // `//evil.example/x` is not a path. Without this guard it is a silent open redirect.
    expect(() => relativeLocation("//evil.example/steal")).toThrow(/same-origin path/);
  });

  it("refuses an absolute URL", () => {
    expect(() => relativeLocation("https://evil.example/steal")).toThrow(/same-origin path/);
    expect(() => relativeLocation("dashboard")).toThrow(/same-origin path/);
  });
});
