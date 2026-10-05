import { describe, expect, it } from "vitest";
import { hotelAlertRecipients } from "./alert-recipients";

describe("hotelAlertRecipients", () => {
  it("uses the reservation mailbox when set", () => {
    expect(hotelAlertRecipients({ primary: "res@h.bg", secondary: "Res@h.bg", contact: "info@h.bg", owners: ["o@h.bg"] })).toEqual(["res@h.bg"]);
  });
  it("falls back to the contact address, then the owners — never to nobody while anyone exists", () => {
    expect(hotelAlertRecipients({ primary: null, secondary: "", contact: "info@h.bg", owners: ["o@h.bg"] })).toEqual(["info@h.bg"]);
    expect(hotelAlertRecipients({ primary: null, secondary: null, contact: null, owners: ["o@h.bg", "x"] })).toEqual(["o@h.bg"]);
    expect(hotelAlertRecipients({ primary: null, secondary: null, contact: null, owners: [] })).toEqual([]);
  });
});
