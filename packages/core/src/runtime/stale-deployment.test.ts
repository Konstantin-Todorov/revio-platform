import { describe, it, expect } from "vitest";
import {
  isStaleDeploymentError,
  shouldAutoReload,
  STALE_RELOAD_COOLDOWN_MS,
} from "./stale-deployment";

describe("isStaleDeploymentError — the tab is old, the app is fine", () => {
  it("recognises the exact error production threw", () => {
    // Verbatim from AppError on 2026-09-07, twice on /login.
    const real = new Error(
      "Failed to find Server Action. This request might be from an older or newer deployment.\n" +
        "Read more: https://nextjs.org/docs/messages/failed-to-find-server-action",
    );
    expect(isStaleDeploymentError(real)).toBe(true);
  });

  it("recognises a stale chunk load", () => {
    expect(isStaleDeploymentError(new Error("Loading chunk 4821 failed."))).toBe(true);
    expect(isStaleDeploymentError(new Error("Failed to fetch dynamically imported module: /_next/x.js"))).toBe(true);
  });

  it("recognises Safari's wording for the same thing", () => {
    expect(isStaleDeploymentError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("accepts a bare string", () => {
    expect(isStaleDeploymentError("Failed to find Server Action.")).toBe(true);
  });

  it("does NOT swallow a real fault", () => {
    /*
     * The whole risk of this predicate: reloading the page on the wrong error hides a genuine bug
     * behind a refresh, and the user sees a flicker instead of a report.
     */
    expect(isStaleDeploymentError(new Error("Invalid `prisma.ratePrice.upsert()` invocation"))).toBe(false);
    expect(isStaleDeploymentError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleDeploymentError(new Error("Unauthorized"))).toBe(false);
    expect(isStaleDeploymentError(new TypeError("x is not a function"))).toBe(false);
  });

  it("is not fooled by an empty or absent message", () => {
    expect(isStaleDeploymentError(new Error(""))).toBe(false);
    expect(isStaleDeploymentError(null)).toBe(false);
    expect(isStaleDeploymentError(undefined)).toBe(false);
    expect(isStaleDeploymentError({})).toBe(false);
    expect(isStaleDeploymentError(42)).toBe(false);
  });
});

describe("shouldAutoReload — heal silently, but never loop", () => {
  const NOW = 1_700_000_000_000;

  it("reloads when we have never reloaded", () => {
    expect(shouldAutoReload(null, NOW)).toBe(true);
  });

  it("refuses a second reload inside the cooldown", () => {
    // An app that reloads forever is far worse than one that shows a button.
    expect(shouldAutoReload(NOW - 1_000, NOW)).toBe(false);
    expect(shouldAutoReload(NOW - STALE_RELOAD_COOLDOWN_MS, NOW)).toBe(false);
  });

  it("heals again long afterwards, rather than being once-only", () => {
    // A second deploy a week later deserves the same silent fix.
    expect(shouldAutoReload(NOW - 7 * 86_400_000, NOW)).toBe(true);
  });

  it("refuses when the stored value is nonsense rather than gambling on a loop", () => {
    expect(shouldAutoReload(Number.NaN, NOW)).toBe(false);
    expect(shouldAutoReload(Infinity, NOW)).toBe(false);
  });
});
