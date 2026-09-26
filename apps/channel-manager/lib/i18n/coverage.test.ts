import { describe, expect, it } from "vitest";
import { translationCoverage, type Translations } from "@revio/ui/i18n";
import { shell } from "./shell";
import { auth } from "./auth";
import { pages } from "./pages";
import { dashboard } from "./dashboard";
import { reservations } from "./reservations";

/**
 * Dictionaries that are fully Bulgarian stay fully Bulgarian — the same guard RevioCRS and RevioPMS
 * have. A missing key falls back to English at runtime, deliberately, so a gap never breaks a
 * screen; that is exactly why a gap has to fail somewhere. Every RevioLink dictionary is listed
 * here; `lib/i18n/ready.ts` is switched on only when this passes with all of them.
 */
const COMPLETE: Record<string, Translations<unknown>> = { shell, auth, pages, dashboard, reservations } as Record<string, Translations<unknown>>;

describe("RevioLink dictionaries have every string in Bulgarian", () => {
  for (const [name, dict] of Object.entries(COMPLETE)) {
    it(name, () => {
      expect(translationCoverage(dict).missing).toEqual([]);
    });
  }
});
