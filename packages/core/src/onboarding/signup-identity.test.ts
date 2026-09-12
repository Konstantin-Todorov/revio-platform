import { describe, it, expect } from "vitest";
import { emailIdentityKey, isDisposableEmail, signupVerdict } from "./signup-identity.js";

describe("emailIdentityKey", () => {
  it("⚠️ collapses plus-addressing — the commonest way one person takes a trial four times", () => {
    const base = emailIdentityKey("maria@cabacum.bg");
    for (const alias of ["maria+trial@cabacum.bg", "maria+again@cabacum.bg", "maria+2026@cabacum.bg"]) {
      expect(emailIdentityKey(alias)).toBe(base);
    }
  });

  it("collapses Gmail dots, which are not part of the mailbox", () => {
    expect(emailIdentityKey("m.a.r.i.a@gmail.com")).toBe("maria@gmail.com");
    expect(emailIdentityKey("maria@googlemail.com")).toBe("maria@googlemail.com");
  });

  it("does NOT strip dots anywhere else — elsewhere they are part of the name", () => {
    // maria.ivanova@ and mariaivanova@ are two different people at a normal mail host, and
    // merging them would hand one hotelier another one's account.
    expect(emailIdentityKey("maria.ivanova@cabacum.bg")).toBe("maria.ivanova@cabacum.bg");
    expect(emailIdentityKey("maria.ivanova@outlook.com")).toBe("maria.ivanova@outlook.com");
  });

  it("lowercases and trims", () => {
    expect(emailIdentityKey("  Maria@Cabacum.BG ")).toBe("maria@cabacum.bg");
  });

  it("keeps two genuinely different people apart", () => {
    expect(emailIdentityKey("maria@cabacum.bg")).not.toBe(emailIdentityKey("ivan@cabacum.bg"));
    expect(emailIdentityKey("maria@a.com")).not.toBe(emailIdentityKey("maria@b.com"));
  });

  it("does not fall over on rubbish", () => {
    expect(emailIdentityKey("")).toBe("");
    expect(emailIdentityKey("@nope.com")).toBe("@nope.com");
    expect(emailIdentityKey("no-at-sign")).toBe("no-at-sign");
  });
});

describe("isDisposableEmail", () => {
  it("spots the throwaway providers", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("A@YOPMAIL.COM")).toBe(true);
  });

  it("leaves real mailboxes alone, including free ones a small hotel really uses", () => {
    for (const e of ["maria@gmail.com", "info@cabacum.bg", "reception@abv.bg", "a@outlook.com"]) {
      expect(isDisposableEmail(e)).toBe(false);
    }
  });
});

describe("signupVerdict", () => {
  it("creates when nobody has the mailbox", () => {
    expect(signupVerdict({ email: "maria@cabacum.bg", existing: null })).toEqual({ kind: "create" });
  });

  it("refuses a throwaway address before anything is created", () => {
    const v = signupVerdict({ email: "a@mailinator.com", existing: null });
    expect(v.kind).toBe("refused");
  });

  it("⚠️ resends rather than blocking when a signup was never finished", () => {
    // The address exists but no password was ever set. Telling this person "you already have an
    // account" and sending them to sign in locks them out of a product they never got into — for
    // mistyping an address or having the first mail land in spam.
    const v = signupVerdict({
      email: "maria@cabacum.bg",
      existing: { hasPassword: false, tenantStatus: "pending_signup" },
    });
    expect(v).toEqual({ kind: "resend-confirmation" });
  });

  it("⚠️ sends a finished account to sign in — never to a second trial", () => {
    // The gap the founder named: a hotel that trialled CRS and PMS, did not buy, and comes back
    // months later through the signup form. No new trial may start here.
    const v = signupVerdict({
      email: "maria@cabacum.bg",
      existing: { hasPassword: true, tenantStatus: "active" },
    });
    expect(v).toEqual({ kind: "already-a-customer", reason: "active" });
  });

  it("tells a suspended account apart, so it can be told something true", () => {
    const v = signupVerdict({
      email: "maria@cabacum.bg",
      existing: { hasPassword: true, tenantStatus: "suspended" },
    });
    expect(v).toEqual({ kind: "already-a-customer", reason: "suspended" });
  });

  it("⚠️ an alias of a finished account is the same account", () => {
    // The whole point of the identity key: the caller looks up by key, so this verdict is reached
    // for maria+trial2@ exactly as it is for maria@.
    expect(emailIdentityKey("maria+trial2@gmail.com")).toBe(emailIdentityKey("maria@gmail.com"));
  });
});
