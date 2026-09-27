import { describe, expect, it } from "vitest";
import { signupVerdict, validateSignup } from "@revio/core";
import { signup } from "./signup";

/** The signup refusals core writes in English, worded by code here — the English must stay core's. */
describe("signup refusals match core, in English", () => {
  const e = signup.en.errors;
  const ok = { hotelName: "Hotel Sofia", ownerName: "Maria", email: "maria@hotel.bg", intent: "cm" };
  it("every form refusal, by its code", () => {
    const cases = [
      { ...ok, hotelName: "" }, { ...ok, hotelName: "x".repeat(121) }, { ...ok, ownerName: "" },
      { ...ok, email: "not-an-email" }, { ...ok, intent: "nothing" },
    ];
    const seen = new Set<string>();
    for (const c of cases) {
      const v = validateSignup(c);
      if (v.ok) throw new Error("expected a refusal");
      expect(e[v.code]).toBe(v.message);
      seen.add(v.code);
    }
    expect(seen.size).toBe(5);
  });
  it("a temporary mailbox", () => {
    const v = signupVerdict({ email: "someone@mailinator.com", existing: null });
    if (v.kind !== "refused") throw new Error("expected a refusal");
    expect(e[v.code]).toBe(v.message);
  });
});
