import { describe, expect, it } from "vitest";
import { isUndeliverable } from "./transport.js";

/**
 * On 2026-09-17 the account's last 82 messages were 61 delivered and 21 bounced — a 26% bounce rate,
 * and 20 of the 21 were the two permanent demo tenants' fake addresses. Providers throttle and then
 * suspend on bounce rate, and every alert this platform sends leaves by the same domain: a rehearsal
 * against a demo hotel was spending the deliverability a real hotel's "your booking is not in the
 * calendar" email depends on.
 */
describe("isUndeliverable", () => {
  it("catches the exact addresses that produced 20 of our 21 bounces", () => {
    expect(isUndeliverable("admin@hotelsofia.demo")).toBe(true);
    expect(isUndeliverable("owner@blacksea.demo")).toBe(true);
  });

  it("catches the RFC-reserved domains too", () => {
    for (const a of ["a@b.test", "a@b.example", "a@b.invalid", "a@b.localhost"]) {
      expect(isUndeliverable(a)).toBe(true);
    }
  });

  it("lets every real address through, including the ones our clients use", () => {
    for (const a of ["v.mukovv@gmail.com", "mbus2015@abv.bg", "office@reviosoft.app", "x@sub.domain.co.uk"]) {
      expect(isUndeliverable(a)).toBe(false);
    }
  });

  /* A `.demo` SUBDOMAIN is a real address — only the last label decides. */
  it("reads the last label, not any label", () => {
    expect(isUndeliverable("a@demo.hotelsofia.com")).toBe(false);
    expect(isUndeliverable("a@test.example.org")).toBe(false);
  });

  it("treats a malformed address as undeliverable rather than sending it", () => {
    expect(isUndeliverable("not-an-address")).toBe(true);
  });

  it("is case- and whitespace-insensitive, because addresses arrive as typed", () => {
    expect(isUndeliverable("Admin@HotelSofia.DEMO ")).toBe(true);
  });
});
