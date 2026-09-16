import { describe, expect, it } from "vitest";

import { trialOpenedEmail } from "./trial-emails";
import { TRIAL_DAYS } from "../trials/trials";

const ENDS = new Date("2026-10-16T00:00:00Z");
const fmt = (d: Date) => d.toISOString().slice(0, 10);

const base = {
  name: "Maria",
  hotelName: "Hotel Sofia",
  product: "cm" as const,
  endsAt: ENDS,
  url: "https://cm.reviosoft.app/dashboard",
  formatDate: fmt,
};

describe("trialOpenedEmail", () => {
  it("states the end date in the subject, the preheader and the body", () => {
    const mail = trialOpenedEmail(base);
    // A hotel decides whether to care about this email from the subject line alone. The date is the
    // whole point of the mail, so it cannot live only in the body.
    expect(mail.subject).toContain("2026-10-16");
    expect(mail.subject).toContain("RevioLink");
    expect(mail.text).toContain("2026-10-16");
    expect(mail.html).toContain("2026-10-16");
  });

  it("says the clock starts today rather than at signup", () => {
    // This is the only place a hotel learns that the thirty days moved. Trials used to begin at
    // signup, so someone who spent a fortnight in the PMS met RevioLink with half of it gone.
    const mail = trialOpenedEmail(base);
    expect(mail.text).toMatch(/start today — not when you signed up/);
    expect(mail.text).toContain(String(TRIAL_DAYS));
  });

  it("promises a conversation, not a shutdown — the same as the in-product strip", () => {
    const mail = trialOpenedEmail(base);
    expect(mail.text).toMatch(/nothing is deleted/i);
    expect(mail.text).toMatch(/we will talk to you first/i);
    // Never imply an automatic charge: nothing in the platform takes a card at trial end.
    expect(mail.text).not.toMatch(/your card will be charged|automatically billed/i);
  });

  it("explains the trial for a first product and the inheritance for a later one", () => {
    const first = trialOpenedEmail(base);
    expect(first.text).toMatch(/shared with the other Revio products/i);
    expect(first.text).not.toMatch(/carried over/i);

    const second = trialOpenedEmail({ ...base, product: "crs", alreadyOpen: ["pms"] });
    expect(second.text).toMatch(/carried over from RevioPMS/);
    expect(second.text).toMatch(/nothing to migrate/i);
  });

  it("lists two earlier products with 'and', not a trailing comma", () => {
    const mail = trialOpenedEmail({ ...base, product: "crs", alreadyOpen: ["cm", "pms"] });
    expect(mail.text).toContain("RevioLink and RevioPMS");
  });

  it("never claims a product inherited from itself", () => {
    // `alreadyOpen` comes from a query that can legitimately include the product being opened,
    // depending on when the row was stamped. Naming it would read as a bug to the reader.
    const mail = trialOpenedEmail({ ...base, product: "cm", alreadyOpen: ["cm"] });
    expect(mail.text).not.toMatch(/carried over/i);
  });

  it("works without a name", () => {
    // `exactOptionalPropertyTypes` is on, so the absence of a name is an absent KEY, not `undefined`
    // — which is also how the caller builds it from a nullable database column.
    const { name: _omitted, ...withoutName } = base;
    const mail = trialOpenedEmail(withoutName);
    expect(mail.text).toContain("Hello,");
    expect(mail.text).not.toContain("undefined");
  });

  it("carries the hotel's name and a way back in", () => {
    const mail = trialOpenedEmail(base);
    expect(mail.text).toContain("Hotel Sofia");
    // The bare URL must appear in the text part — a button is not clickable in a plain-text client.
    expect(mail.text).toContain(base.url);
    expect(mail.html).toContain(base.url);
  });

  it("names each product correctly", () => {
    expect(trialOpenedEmail({ ...base, product: "crs" }).subject).toContain("RevioCRS");
    expect(trialOpenedEmail({ ...base, product: "pms" }).subject).toContain("RevioPMS");
  });
});
