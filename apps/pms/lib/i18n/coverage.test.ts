import { describe, expect, it } from "vitest";
import { translationCoverage, type Translations } from "@revio/ui/i18n";
import { shell } from "./shell";
import { housekeeping } from "./housekeeping";
import { common } from "./common";
import { frontdesk } from "./frontdesk";
import { stays } from "./stays";
import { reservation } from "./reservation";
import { folio } from "./folio";
import { folios } from "./folios";
import { operations } from "./operations";
import { extras } from "./extras";
import { rooms } from "./rooms";
import { calendar } from "./calendar";

/**
 * Dictionaries that are fully Bulgarian stay fully Bulgarian.
 *
 * A missing key falls back to English at runtime — deliberately, so a gap never breaks a screen.
 * Which is exactly why a gap has to fail SOMEWHERE: a fallback nobody measures becomes a permanent
 * half-English screen. A new English string in a finished dictionary fails here until its Bulgarian
 * lands in the same change. A dictionary still being translated is simply not listed yet.
 */
const COMPLETE: Record<string, Translations<unknown>> = { shell, housekeeping, common, frontdesk, stays, reservation, folio, folios, operations, extras, rooms, calendar } as Record<string, Translations<unknown>>;

describe("finished dictionaries have every string in Bulgarian", () => {
  for (const [name, dict] of Object.entries(COMPLETE)) {
    it(name, () => {
      expect(translationCoverage(dict).missing).toEqual([]);
    });
  }
});
