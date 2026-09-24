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
import { guests } from "./guests";
import { register } from "./register";
import { users } from "./users";
import { configuration } from "./configuration";
import { settings } from "./settings";
import { pages } from "./pages";
import { auth } from "./auth";
import { authStrings, authRefusalStrings } from "@revio/ui/auth-strings";
import { accountStrings } from "@revio/ui/account-strings";
import { shellStrings } from "@revio/ui/shell-strings";
import { notifications } from "./notifications";
import { welcome } from "./welcome";
import { flash } from "./flash";
import { activityStrings } from "@revio/ui/activity-strings";
import { trialStrings } from "@revio/ui/trial-banner";
import { helpStrings } from "@revio/ui/help-strings";
import { welcomeStrings } from "@revio/ui/welcome-strings";
import { billingStrings } from "@revio/ui/billing-strings";
import { productStrings } from "@revio/ui/product-strings";
import { guestEmailsStrings } from "@revio/ui/guest-emails-strings";

/**
 * Dictionaries that are fully Bulgarian stay fully Bulgarian.
 *
 * A missing key falls back to English at runtime — deliberately, so a gap never breaks a screen.
 * Which is exactly why a gap has to fail SOMEWHERE: a fallback nobody measures becomes a permanent
 * half-English screen. A new English string in a finished dictionary fails here until its Bulgarian
 * lands in the same change. A dictionary still being translated is simply not listed yet.
 */
const COMPLETE: Record<string, Translations<unknown>> = { shell, housekeeping, common, frontdesk, stays, reservation, folio, folios, operations, extras, rooms, calendar, guests, register, users, configuration, settings, pages, auth, authStrings, accountStrings, shellStrings, notifications, welcome, welcomeStrings, flash, activityStrings, trialStrings, helpStrings, billingStrings, productStrings, authRefusalStrings, guestEmailsStrings } as Record<string, Translations<unknown>>;

describe("finished dictionaries have every string in Bulgarian", () => {
  for (const [name, dict] of Object.entries(COMPLETE)) {
    it(name, () => {
      expect(translationCoverage(dict).missing).toEqual([]);
    });
  }
});

import { HELP_ARTICLES } from "@revio/core";

/** The articles are keyed by id and sit outside the English dictionary, so they are counted here. */
describe("every help article is in Bulgarian", () => {
  it("helpStrings.articles", () => {
    const bg = helpStrings.bg.articles ?? {};
    expect(HELP_ARTICLES.filter((a) => !bg[a.id]?.question || !bg[a.id]?.answer).map((a) => a.id)).toEqual([]);
  });
});
