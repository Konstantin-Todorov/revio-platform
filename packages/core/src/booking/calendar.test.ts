import { describe, expect, it } from "vitest";
import { stayGoogleCalendarUrl, stayIcs } from "./calendar";

const e = {
  uid: "RV-ABC123@reviosoft.app", title: "Hotel Sofia, Varna", checkIn: "2026-10-20", checkOut: "2026-10-23",
  checkInTime: "14:00", checkOutTime: "12:00", timezone: "Europe/Sofia", location: "бул. Приморски 10, Варна", description: "RV-ABC123",
};

describe("stay calendar", () => {
  it("writes an event in the hotel's time zone, check-in to check-out", () => {
    const ics = stayIcs(e, new Date("2026-10-05T10:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=Europe/Sofia:20261020T140000");
    expect(ics).toContain("DTEND;TZID=Europe/Sofia:20261023T120000");
    expect(ics).toContain("SUMMARY:Hotel Sofia\\, Varna");
    expect(stayIcs({ ...e, title: "A;B" })).toContain("SUMMARY:A\\;B");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it("gives Google the same times", () => {
    const u = new URL(stayGoogleCalendarUrl(e));
    expect(u.searchParams.get("dates")).toBe("20261020T140000/20261023T120000");
    expect(u.searchParams.get("ctz")).toBe("Europe/Sofia");
  });
});
