import { describe, expect, it } from "vitest";
import { config } from "../middleware";

/**
 * ⚠️ Every path the matcher excludes is reached by something that has no session and cannot get one.
 *
 * A 307 to /login is not an error any of them can report: a cron ignores the redirect, a mail client
 * shows a broken image, an uptime monitor follows it and calls the service healthy. The webhook was
 * shipped missing from this list and the symptom would have been *nothing* — Channex disabling an
 * endpoint that kept failing, while bookings carried on arriving on the five-minute poll.
 *
 * The regex is the only place that decision is enforced, so it is the thing tested.
 */
const gated = (path: string) => new RegExp(`^${config.matcher[0]!.replace(/^\//, "\\/")}$`).test(path);

describe("what the cookie gate must never touch", () => {
  for (const p of [
    "/api/webhooks/channex",
    "/api/jobs/pull",
    "/api/brand/prop-1/logo",
    "/api/health",
  ]) {
    it(`lets ${p} through`, () => expect(gated(p)).toBe(false));
  }
});

describe("what it must still gate", () => {
  for (const p of ["/dashboard", "/mapping", "/channels", "/api/other"]) {
    it(`gates ${p}`, () => expect(gated(p)).toBe(true));
  }
});
