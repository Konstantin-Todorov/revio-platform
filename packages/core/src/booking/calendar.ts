/**
 * The stay as a calendar event — check-in time on the arrival day to check-out time on the last —
 * for "Add to calendar" on the confirmation. Pure, so the .ics file and the Google link say the same.
 *
 * Times are wall-clock in the HOTEL's time zone (TZID), never UTC: 14:00 in Sofia is 14:00 in the
 * guest's calendar when they arrive, whatever zone they booked from.
 */
export interface StayEvent {
  uid: string;
  title: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  checkInTime: string; // HH:MM
  checkOutTime: string;
  timezone: string;
  location?: string | null;
  description?: string | null;
}

const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${(/^\d{1,2}:\d{2}$/.test(time) ? time : "14:00").padStart(5, "0").replace(":", "")}00`;

/** RFC 5545 text: escape \ ; , and newlines. */
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function stayIcs(e: StayEvent, now: Date = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Revio//RevioDirect//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${e.timezone}:${stamp(e.checkIn, e.checkInTime)}`,
    `DTEND;TZID=${e.timezone}:${stamp(e.checkOut, e.checkOutTime)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function stayGoogleCalendarUrl(e: StayEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.checkIn, e.checkInTime)}/${stamp(e.checkOut, e.checkOutTime)}`,
    ctz: e.timezone,
    ...(e.location ? { location: e.location } : {}),
    ...(e.description ? { details: e.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** A directions link that opens the phone's maps app (Google Maps, or Apple Maps via its handoff). */
export function directionsUrl(name: string, address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name}, ${address}`)}`;
}
