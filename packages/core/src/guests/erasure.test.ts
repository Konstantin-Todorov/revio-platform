import { describe, it, expect } from "vitest";
import {
  planGuestErasure, buildGuestExport, exportFilename,
  ERASED_DISPLAY, ERASURE_RETAINED, type GuestExportInput,
} from "./erasure.js";

const guest = { id: "g1", firstName: "Ventsi", lastName: "Mukov", erasedAt: null };
const NOW = new Date("2026-08-29T10:00:00Z");

describe("planGuestErasure", () => {
  it("clears every contact field on the guest", () => {
    const p = planGuestErasure(guest, { now: NOW });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.guest).toMatchObject({
      email: null, phone: null, company: null, specialRequests: null, erasedAt: NOW,
    });
  });

  it("also anonymises Reservation.guestName — the denormalised copy that gets missed", () => {
    // Erasing only the Guest table leaves the name on every reservation: an erasure that looks
    // complete on the screen you did it from and nowhere else.
    const p = planGuestErasure(guest, { now: NOW });
    expect(p.ok && p.reservation.guestName).toBe(ERASED_DISPLAY);
  });

  it("clears reservation notes and deletes guest notes", () => {
    // Free text cannot be anonymised, and these are the rows most likely to hold an opinion.
    const p = planGuestErasure(guest, { now: NOW });
    expect(p.ok && p.reservation.notes).toBeNull();
    expect(p.ok && p.deleteNotes).toBe(true);
  });

  it("clears the OTA-alias flag with the address it described", () => {
    const p = planGuestErasure(guest, { now: NOW });
    expect(p.ok && p.guest.emailIsOtaAlias).toBe(false);
  });

  it("uses a placeholder name, not a blank one", () => {
    // A list of empty names reads as broken data and invites someone to "fix" it.
    const p = planGuestErasure(guest, { now: NOW });
    expect(p.ok && p.guest.firstName.length).toBeGreaterThan(0);
    expect(ERASED_DISPLAY).toMatch(/erased/i);
  });

  it("captures the real name for the audit line before it is gone", () => {
    expect(planGuestErasure(guest, { now: NOW })).toMatchObject({ describe: "Ventsi Mukov" });
  });

  it("refuses a record already erased", () => {
    const p = planGuestErasure({ ...guest, erasedAt: new Date("2026-01-01") });
    expect(p).toMatchObject({ ok: false, refusal: "already-erased" });
  });

  it("refuses the loser of a merge and points at the survivor", () => {
    // Erasing the loser would leave the record that actually holds the data untouched, and report
    // success — the worst possible outcome for a right the person only exercises once.
    const p = planGuestErasure(guest, { mergedIntoId: "g2" });
    expect(p).toMatchObject({ ok: false, refusal: "merged-record" });
    expect(p.ok === false && p.message).toMatch(/surviving record/i);
  });

  it("states what is retained and why, with the legal basis", () => {
    expect(ERASURE_RETAINED.some((r) => /17\(3\)\(b\)/.test(r.why))).toBe(true);
    expect(ERASURE_RETAINED.some((r) => /invoice/i.test(r.what))).toBe(true);
  });
});

describe("buildGuestExport", () => {
  const input: GuestExportInput = {
    guest: {
      id: "g1", firstName: "Ventsi", lastName: "Mukov",
      email: "v@example.com", emailIsOtaAlias: false, phone: "+359888123456",
      company: null, specialRequests: "Quiet room",
      createdAt: new Date("2026-01-15T09:00:00Z"), recognitionOptOut: false,
    },
    reservations: [{
      reference: "RV-01AB", status: "confirmed", checkIn: "2026-03-01", checkOut: "2026-03-04",
      source: "Booking.com", totalMinor: 42000, currency: "EUR", notes: null,
    }],
    notes: [{ author: "Maria", body: "Prefers a high floor.", createdAt: new Date("2026-03-02T08:00:00Z") }],
    invoices: [{ number: "1000000001", issuedAt: new Date("2026-03-04T11:00:00Z"), grossMinor: 42000, currency: "EUR" }],
    propertyName: "Villa Sofia",
  };

  it("includes contact, stays, staff notes and invoices", () => {
    const e = buildGuestExport(input, NOW);
    expect(e.contact.email).toBe("v@example.com");
    expect(e.stays).toHaveLength(1);
    expect(e.staffNotes).toHaveLength(1);
    expect(e.invoices).toHaveLength(1);
  });

  it("converts minor units to a readable amount", () => {
    // The person reading this is not a developer; 42000 would be misread as forty-two thousand.
    expect((buildGuestExport(input, NOW).stays[0] as { total: number }).total).toBe(420);
  });

  it("declares what is retained, so an access request is not quietly incomplete", () => {
    // The person is entitled to know a tax document with their name on it exists and will be kept.
    expect(buildGuestExport(input, NOW).retained).toEqual(ERASURE_RETAINED);
  });

  it("says plainly when the address on file is an OTA forwarding address", () => {
    const e = buildGuestExport({ ...input, guest: { ...input.guest, emailIsOtaAlias: true } }, NOW);
    expect(e.contact.emailIsForwardingAddressFromABookingSite).toBe(true);
  });

  it("includes staff notes — they are personal data about the subject", () => {
    expect(buildGuestExport(input, NOW).staffNotes[0]).toMatchObject({ note: "Prefers a high floor." });
  });

  it("is JSON-serialisable end to end", () => {
    expect(() => JSON.stringify(buildGuestExport(input, NOW))).not.toThrow();
  });
});

describe("exportFilename", () => {
  it("is readable and cannot collide across guests or days", () => {
    expect(exportFilename({ firstName: "Ventsi", lastName: "Mukov", id: "abc123xyz789" }, NOW))
      .toBe("ventsi-mukov-xyz789-2026-08-29.json");
  });
  it("survives a name with no latin characters", () => {
    const f = exportFilename({ firstName: "Венци", lastName: "Муков", id: "abc123xyz789" }, NOW);
    expect(f).toBe("guest-xyz789-2026-08-29.json");
  });
});
