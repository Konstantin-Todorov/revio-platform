import { describe, expect, it } from "vitest";

import { importFailureEmail } from "./import-failure";

const base = {
  hotelName: "Cabacum Beach Residence",
  channelName: "Booking.com",
  guestName: "Desislava Gospodinova",
  reference: "6834e91d",
  total: "€3.60",
  unmapped: "rate 0ea321e7 (2026-09-20 → 2026-09-22)",
  mappingUrl: "https://cm.reviosoft.app/mapping",
};

describe("importFailureEmail", () => {
  it("leads with the consequence, not our mapping problem", () => {
    // "Your channel mapping is incomplete" describes OUR problem. "The room is still on sale"
    // describes theirs, and it is the sentence that makes somebody act today.
    const mail = importFailureEmail(base);
    expect(mail.subject).toMatch(/not in your calendar/i);
    expect(mail.text).toMatch(/nobody is holding that room/i);
    expect(mail.text).toMatch(/guest believes they have it/i);
  });

  it("⚠️ never says the booking was lost", async () => {
    // The hotel this was written for disconnected its channel because it believed bookings were
    // being dropped. A mail that implies the same thing would cause the same thing.
    const mail = importFailureEmail(base);
    expect(mail.text).toMatch(/nothing has been lost/i);
    expect(mail.text).not.toMatch(/\blost\b(?!\.)|dropped|deleted|failed to receive/i);
  });

  it("carries what the hotel needs to find it on the channel's extranet", () => {
    const mail = importFailureEmail(base);
    for (const fact of ["Desislava Gospodinova", "6834e91d", "€3.60", "Booking.com"]) {
      expect(mail.text).toContain(fact);
    }
  });

  it("names what was not mapped, so it is actionable rather than a riddle", () => {
    const mail = importFailureEmail(base);
    expect(mail.text).toContain("rate 0ea321e7");
    expect(mail.text).toContain(base.mappingUrl);
  });

  it("still sends when even the unmapped ids are unknown", () => {
    // A mail about something going wrong must not itself fall over on a missing field.
    const mail = importFailureEmail({ ...base, unmapped: "" });
    expect(mail.text).not.toContain("Sold as");
    expect(mail.text).toMatch(/not in your calendar/i);
  });

  it("says it is not routine, so it is not filed as noise", () => {
    expect(importFailureEmail(base).text).toMatch(/not a routine notification/i);
  });
});
