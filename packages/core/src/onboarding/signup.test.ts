import { describe, it, expect } from "vitest";
import { signupSlug, validateSignup, type SignupInput } from "./signup.js";
import { signupEmail } from "../email/auth-emails.js";
import { TOKEN_POLICY } from "../auth/tokens.js";

const GOOD: SignupInput = {
  hotelName: "Hotel Cabacum Beach",
  ownerName: "Maria Ivanova",
  email: "Maria@Cabacum.BG",
  intent: "cm",
};

describe("validateSignup", () => {
  it("accepts a normal signup and lowercases the address", () => {
    const v = validateSignup(GOOD);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.fields.email).toBe("maria@cabacum.bg");
    expect(v.fields.intent).toBe("cm");
  });

  it("trims what people paste", () => {
    const v = validateSignup({ ...GOOD, hotelName: "  Hotel Sofia  ", ownerName: " Ivan " });
    expect(v.ok && v.fields.hotelName).toBe("Hotel Sofia");
    expect(v.ok && v.fields.ownerName).toBe("Ivan");
  });

  it("refuses an empty hotel, an empty name and a bad address", () => {
    expect(validateSignup({ ...GOOD, hotelName: "   " })).toMatchObject({ ok: false });
    expect(validateSignup({ ...GOOD, ownerName: "" })).toMatchObject({ ok: false });
    for (const email of ["", "maria", "maria@", "@cabacum.bg", "maria@cabacum", "a b@c.d"]) {
      expect(validateSignup({ ...GOOD, email }).ok).toBe(false);
    }
  });

  it("refuses an intent that is not one of the three products", () => {
    expect(validateSignup({ ...GOOD, intent: "" }).ok).toBe(false);
    expect(validateSignup({ ...GOOD, intent: "booking" }).ok).toBe(false);
    for (const intent of ["cm", "crs", "pms"]) {
      expect(validateSignup({ ...GOOD, intent }).ok).toBe(true);
    }
  });

  it("⚠️ never says anything about an account behind the address", () => {
    // The refusals must describe the FORM only. A message that distinguishes a known address from
    // an unknown one turns this page into a directory of who our customers are.
    const messages: string[] = [];
    for (const bad of [
      { ...GOOD, hotelName: "" }, { ...GOOD, ownerName: "" }, { ...GOOD, email: "nope" }, { ...GOOD, intent: "x" },
    ]) {
      const v = validateSignup(bad);
      if (!v.ok) messages.push(v.message.toLowerCase());
    }
    expect(messages).toHaveLength(4);
    for (const m of messages) {
      for (const leak of ["already", "exists", "registered", "taken", "in use", "account"]) {
        expect(m).not.toContain(leak);
      }
    }
  });
});

describe("signupSlug", () => {
  it("makes a URL-safe slug from an ordinary name", () => {
    expect(signupSlug("Hotel Cabacum Beach")).toBe("hotel-cabacum-beach");
  });

  it("keeps the letter when stripping accents", () => {
    // "Hôtel" must become "hotel", not "htel" — the second loses a letter and reads as a typo.
    expect(signupSlug("Hôtel Rivière")).toBe("hotel-riviere");
  });

  it("survives punctuation and collapses the gaps it leaves", () => {
    expect(signupSlug("Smith & Sons' Guest-House!!")).toBe("smith-sons-guest-house");
  });

  it("⚠️ never returns an empty slug", () => {
    // A blank slug collides with every other blank one, and the first hotel to hit it silently
    // takes the second's URL. Cyrillic strips to nothing here, and that is the common case for us.
    for (const name of ["", "   ", "!!!", "хотел", "日本"]) {
      expect(signupSlug(name)).toBe("hotel");
    }
  });

  it("caps the length without leaving a trailing dash", () => {
    const slug = signupSlug("A".repeat(30) + " " + "B".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("signupEmail", () => {
  const mail = signupEmail({ name: "Maria", context: "Hotel Cabacum Beach", url: "https://cm.reviosoft.app/accept-invite/abc" });

  it("does NOT say somebody added them — they added themselves", () => {
    // inviteEmail's "you have been added" is true for a staff invite and a lie to a person who
    // typed their own address into our website thirty seconds ago.
    expect(mail.text).not.toMatch(/been added|has added/i);
  });

  it("says the trial covers all three, which is the fact that brings them back", () => {
    expect(mail.text).toMatch(/all three/i);
    expect(mail.text).toMatch(/30 days/i);
  });

  it("carries the link and says it is single-use", () => {
    expect(mail.text).toContain("https://cm.reviosoft.app/accept-invite/abc");
    expect(mail.text).toMatch(/once/i);
  });
});

describe("the link's lifetime is never re-typed", () => {
  it("⚠️ the signup email states the policy's own label, not a number somebody remembered", () => {
    // This shipped saying "48 hours" on the confirmation screen — a figure that appears nowhere in
    // the code, against a real policy of 7 days. A hotel told the wrong one either abandons a link
    // that still works, or hurries over one that has already died. The only defence is that every
    // surface reads TOKEN_POLICY rather than restating it.
    const mail = signupEmail({ name: "Maria", context: "Hotel X", url: "https://example.test/x" });
    expect(mail.text).toContain(TOKEN_POLICY.invite.ttlLabel);
    expect(mail.text).not.toMatch(/48 hours/);
  });
});
