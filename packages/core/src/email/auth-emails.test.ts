import { describe, expect, it } from "vitest";
import { TOKEN_POLICY } from "../auth/tokens.js";
import { TTL_BG, inviteEmail, passwordChangedEmail, passwordResetEmail } from "./auth-emails.js";
import { trialFinishedEmail, trialOpenedEmail, trialReminderEmail } from "./trial-emails.js";

/**
 * Our own mail in the reader's language. English is pinned elsewhere by its callers' tests; what is
 * pinned here is that Bulgarian is complete — no English sentence left in it — and that the shell
 * around it (the `lang`, the paste hint, the footer) followed.
 */
const ENGLISH_LEFTOVERS = /\b(the|your|you|and|link|password|trial|hello)\b/i;
const bodyText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, "");

describe("account emails in Bulgarian", () => {
  const base = { name: "Мария", context: "Хотел София", url: "https://pms.reviosoft.app/x", locale: "bg" as const };
  const cases = {
    invite: inviteEmail({ ...base, invitedBy: "Иван" }),
    reset: passwordResetEmail(base),
    changed: passwordChangedEmail(base),
  };
  for (const [name, mail] of Object.entries(cases)) {
    it(name, () => {
      expect(mail.html).toContain('<html lang="bg">');
      expect(mail.html).toContain("Изпратено от Revio");
      expect(mail.text).toContain("Здравейте, Мария,");
      expect(bodyText(mail.html).replace(/Revio(PMS)?/g, "")).not.toMatch(ENGLISH_LEFTOVERS);
      expect(mail.subject).not.toMatch(ENGLISH_LEFTOVERS);
    });
  }

  it("English is unchanged when no language is given", () => {
    const mail = inviteEmail({ context: "Hotel Sofia", url: "https://x.test/a" });
    expect(mail.html).toContain('<html lang="en">');
    expect(mail.html).toContain("Or paste this into your browser:");
    expect(mail.subject).toBe("You've been added to Hotel Sofia on Revio");
  });

  it("the Bulgarian link lifetimes follow the policy", () => {
    // A policy change must be a failing test here, not a Bulgarian email promising the old window.
    expect({ invite: TOKEN_POLICY.invite.ttlLabel, reset: TOKEN_POLICY.reset.ttlLabel }).toEqual({ invite: "7 days", reset: "1 hour" });
    expect(TTL_BG).toEqual({ invite: "7 дни", reset: "1 час" });
  });
});

describe("trial emails in Bulgarian", () => {
  it("opened, finished and reminded", () => {
    const opened = trialOpenedEmail({
      hotelName: "Хотел София", product: "pms", endsAt: new Date("2026-10-24T09:00:00Z"), url: "https://pms.test",
      alreadyOpen: ["cm", "crs"], formatDate: () => "24 октомври 2026 г.", locale: "bg",
    });
    expect(opened.text).toContain("RevioLink и RevioCRS");
    expect(opened.subject).toBe("RevioPMS е готов — пробният Ви период е до 24 октомври 2026 г.");

    const finished = trialFinishedEmail({ products: ["RevioLink", "RevioPMS"], locale: "bg" });
    expect(finished.subject).toBe("Пробният Ви период в Revio приключи");
    expect(finished.text).toContain("RevioLink и RevioPMS вече не са");

    expect(trialReminderEmail({ products: ["RevioPMS"], left: 1, endsOn: "2026-10-24", url: "https://x.test", locale: "bg" }).subject)
      .toBe("Остава 1 ден от пробния Ви период в Revio");
    expect(trialReminderEmail({ products: ["RevioPMS"], left: 7, endsOn: "2026-10-24", url: "https://x.test" }).subject)
      .toBe("7 days left on your Revio trial");
    for (const m of [opened, finished]) {
      expect(bodyText(m.html).replace(/Revio(PMS|Link|CRS)?/g, "")).not.toMatch(ENGLISH_LEFTOVERS);
    }
  });
});
