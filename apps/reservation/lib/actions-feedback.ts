"use server";

import { revalidatePath } from "next/cache";
import { flashError, setFlash } from "@revio/ui/flash";
import { normaliseReviewUrl } from "@revio/core";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { logAudit, str } from "./mutation-helpers";
import { prisma } from "./db";

/**
 * Guest feedback settings — where a public review goes, and when we ask.
 *
 * ⚠️ There is deliberately no "only ask guests who rated well" setting, and there must never be one.
 * That is review gating: Google's policies prohibit soliciting reviews selectively, regulators treat
 * it as a deceptive practice, and the consequence lands on the HOTEL's listing rather than on us.
 * The screen says so out loud rather than leaving its absence to be read as an oversight.
 */

/** Sane bounds, so a typo cannot silence the feature or turn it into a nuisance. */
const MAX_ASK_AFTER_DAYS = 30;
const MAX_ASK_EVERY_MONTHS = 60;

export async function saveFeedbackSettings(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();

  /*
   * Read the numbers HERE and refuse them here.
   *
   * `Number(x || "1")` catches an empty field and nothing else, so letters and the comma decimal a
   * European hotelier types both arrive as NaN — which Prisma would reject with a stack trace, or
   * worse, write. Same rule as everywhere else money or counts are parsed from a form.
   */
  const askAfterDays = Number(str(fd, "feedbackAskAfterDays"));
  if (!Number.isFinite(askAfterDays) || askAfterDays < 0 || askAfterDays > MAX_ASK_AFTER_DAYS) {
    return flashError(`"Ask after" must be a whole number of days between 0 and ${MAX_ASK_AFTER_DAYS}.`);
  }
  const askEveryMonths = Number(str(fd, "feedbackAskEveryMonths"));
  if (!Number.isFinite(askEveryMonths) || askEveryMonths < 1 || askEveryMonths > MAX_ASK_EVERY_MONTHS) {
    return flashError(`"Ask at most every" must be between 1 and ${MAX_ASK_EVERY_MONTHS} months.`);
  }

  /*
   * The pasted URLs are rendered as links on a PUBLIC page, so the scheme is a security boundary:
   * `javascript:` in an href is script execution against every guest who clicks. `normaliseReviewUrl`
   * accepts only http/https, adds `https://` to a scheme-less paste, and returns null for anything
   * else. A refusal is reported rather than silently saved as "no button".
   */
  const raw = {
    reviewGoogleUrl: str(fd, "reviewGoogleUrl"),
    reviewTripadvisorUrl: str(fd, "reviewTripadvisorUrl"),
    reviewOwnUrl: str(fd, "reviewOwnUrl"),
  };
  const clean: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(raw)) {
    const normalised = normaliseReviewUrl(value);
    if (value.trim() && normalised == null) {
      return flashError(
        `That does not look like a web address: "${value.slice(0, 60)}". A review link must start with http:// or https://.`,
      );
    }
    clean[field] = normalised;
  }

  const alertEmail = str(fd, "feedbackAlertEmail").trim();
  if (alertEmail && !alertEmail.includes("@")) {
    return flashError("The alert address does not look like an email address.");
  }

  await prisma.property.update({
    where: { id: property.id },
    data: {
      ...clean,
      feedbackEnabled: fd.get("feedbackEnabled") === "on",
      feedbackAskAfterDays: Math.round(askAfterDays),
      feedbackAskEveryMonths: Math.round(askEveryMonths),
      feedbackAlertEmail: alertEmail || null,
    },
  });

  await logAudit(property.id, property.tenantId, {
    entity: "Guest feedback",
    field: "settings",
    newValue: `${fd.get("feedbackEnabled") === "on" ? "on" : "off"} · ask after ${Math.round(askAfterDays)}d · at most every ${Math.round(askEveryMonths)}m`,
  });

  revalidatePath("/settings");
  return setFlash("success", "Guest feedback settings saved.");
}
