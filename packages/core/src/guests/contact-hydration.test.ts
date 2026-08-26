import { describe, it, expect } from "vitest";
import {
  hydrateGuestContact,
  isOtaAliasEmail,
  hasChanges,
  type GuestContact,
} from "./contact-hydration.js";

const blank: GuestContact = { email: null, phone: null, company: null };

describe("rule 1 — enrich empty", () => {
  it("fills a blank phone from the booking", () => {
    // The case from public-engine.ts: a returning guest types their phone and it was thrown away.
    const patch = hydrateGuestContact({ email: "ana@example.com", phone: null }, { phone: "+359888123456" });
    expect(patch).toEqual({ phone: "+359888123456" });
  });

  it("fills every blank field at once", () => {
    const patch = hydrateGuestContact(blank, {
      email: "ana@example.com",
      phone: "+359888123456",
      company: "Acme",
    });
    expect(patch).toEqual({
      email: "ana@example.com",
      phone: "+359888123456",
      company: "Acme",
      emailIsOtaAlias: false,
    });
  });

  it("treats whitespace as empty — a field of spaces is not a confirmed value", () => {
    expect(hydrateGuestContact({ email: null, phone: "   " }, { phone: "+359888" })).toEqual({
      phone: "+359888",
    });
  });

  it("lowercases and trims an incoming email", () => {
    expect(hydrateGuestContact(blank, { email: "  Ana@Example.COM " }).email).toBe("ana@example.com");
  });
});

describe("rule 2 — never overwrite", () => {
  it("leaves a confirmed phone alone", () => {
    const patch = hydrateGuestContact(
      { email: "ana@example.com", phone: "+359888111111" },
      { phone: "+359888999999" },
    );
    expect(patch).toEqual({});
  });

  it("leaves a confirmed email alone even when the booking has a different one", () => {
    const patch = hydrateGuestContact({ email: "real@ana.com", phone: null }, { email: "other@x.com" });
    expect(patch.email).toBeUndefined();
  });

  it("an OTA alias can never displace a real address already on file", () => {
    // The important direction. A later OTA booking must not bury the address the guest gave direct.
    const patch = hydrateGuestContact(
      { email: "ana@gmail.com", phone: null },
      { email: "3x9f@guest.booking.com" },
    );
    expect(patch).toEqual({});
  });

  it("returns nothing when the booking repeats what is already on file", () => {
    const patch = hydrateGuestContact(
      { email: "ana@example.com", phone: "+359888", company: "Acme" },
      { email: "ana@example.com", phone: "+359888", company: "Acme" },
    );
    expect(hasChanges(patch)).toBe(false);
  });

  it("ignores blank incoming values rather than clearing a field", () => {
    const patch = hydrateGuestContact({ email: "ana@x.com", phone: "+359" }, { email: "", phone: "  " });
    expect(patch).toEqual({});
  });
});

describe("rule 3 — tag an OTA alias", () => {
  it("flags a Booking.com relay", () => {
    const patch = hydrateGuestContact(blank, { email: "3x9f@guest.booking.com" });
    expect(patch.email).toBe("3x9f@guest.booking.com");
    expect(patch.emailIsOtaAlias).toBe(true);
  });

  it("does not flag an ordinary address", () => {
    expect(hydrateGuestContact(blank, { email: "ana@gmail.com" }).emailIsOtaAlias).toBe(false);
  });

  it("recognises the relay domains we know about", () => {
    for (const e of [
      "a@guest.booking.com",
      "b@m.expediapartnercentral.com",
      "c@guest.airbnb.com",
      "d@guest.agoda.com",
      "e@stay.trip.com",
    ]) {
      expect(isOtaAliasEmail(e)).toBe(true);
    }
  });

  it("matches a subdomain of a known relay, not just the exact host", () => {
    expect(isOtaAliasEmail("x@prop123.guest.booking.com")).toBe(true);
  });

  it("is not fooled by a lookalike that merely contains the domain", () => {
    // The failure that matters: telling a hotel a real address is fake.
    expect(isOtaAliasEmail("ana@guest.booking.com.evil.net")).toBe(false);
    expect(isOtaAliasEmail("guest.booking.com@gmail.com")).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(isOtaAliasEmail("A@Guest.Booking.COM")).toBe(true);
  });

  it("handles junk without throwing", () => {
    expect(isOtaAliasEmail(null)).toBe(false);
    expect(isOtaAliasEmail("")).toBe(false);
    expect(isOtaAliasEmail("no-at-sign")).toBe(false);
    expect(isOtaAliasEmail("trailing@")).toBe(false);
  });
});
