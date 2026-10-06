import { describe, expect, it } from "vitest";
import { translationCoverage, type Translations } from "@revio/ui/i18n";
import { guest } from "./guest";

/**
 * Everything RevioDirect says to a guest is in Bulgarian, and stays so.
 *
 * A missing key falls back to English at runtime, deliberately — a gap must never break a guest's
 * booking. Which is exactly why a gap has to fail somewhere: a guest booking in Bulgarian would
 * otherwise meet one English button in the middle of paying, and nobody would notice. A new English
 * string in `guest` fails here until its Bulgarian lands in the same change.
 */
describe("RevioDirect's guest dictionary has every string in Bulgarian", () => {
  it("guest", () => {
    expect(translationCoverage(guest as unknown as Translations<unknown>).missing).toEqual([]);
  });
});
