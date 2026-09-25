import { describe, expect, it } from "vitest";
import { translationCoverage, type Translations } from "@revio/ui/i18n";
import { shell } from "./shell";
import { auth } from "./auth";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { pages } from "./pages";
import { notifications } from "./notifications";
import { reservations } from "./reservations";
import { columnStrings } from "@revio/ui/column-strings";
import { waitlist } from "./waitlist";
import { guests } from "./guests";
import { inventory } from "./inventory";
import { rates } from "./rates";
import { bulk } from "./bulk";
import { rateErrors } from "./rate-errors";

/**
 * Dictionaries that are fully Bulgarian stay fully Bulgarian — the same guard RevioPMS has.
 *
 * A missing key falls back to English at runtime, deliberately, so a gap never breaks a screen. That
 * is exactly why a gap has to fail somewhere: a fallback nobody measures becomes a permanent
 * half-English screen. Every RevioCRS dictionary is listed here; `lib/i18n/ready.ts` is switched on
 * only when this passes with all of them.
 */
const COMPLETE: Record<string, Translations<unknown>> = { shell, auth, common, dashboard, pages, notifications, reservations, columnStrings, waitlist, guests, inventory, rates, bulk, rateErrors } as Record<string, Translations<unknown>>;

describe("RevioCRS dictionaries have every string in Bulgarian", () => {
  for (const [name, dict] of Object.entries(COMPLETE)) {
    it(name, () => {
      expect(translationCoverage(dict).missing).toEqual([]);
    });
  }
});
