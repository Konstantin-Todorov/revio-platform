import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, TOKEN_POLICY, checkToken, validatePassword } from "./tokens.js";
import { inviteEmail, passwordChangedEmail, passwordResetEmail } from "../email/auth-emails.js";

const NOW = 1_700_000_000_000;

describe("checkToken", () => {
  it("accepts a fresh, unused token", () => {
    expect(checkToken({ purpose: "reset", expiresAt: NOW + 1000, usedAt: null }, NOW)).toEqual({ usable: true });
  });

  it("rejects an expired token", () => {
    const r = checkToken({ purpose: "reset", expiresAt: NOW - 1, usedAt: null }, NOW);
    expect(r.usable).toBe(false);
    if (!r.usable) expect(r.reason).toBe("expired");
  });

  it("rejects exactly at the expiry instant — a token is dead on its deadline, not after it", () => {
    const r = checkToken({ purpose: "reset", expiresAt: NOW, usedAt: null }, NOW);
    expect(r.usable).toBe(false);
  });

  it("reports 'used' ahead of 'expired' when a token is both", () => {
    // Someone clicking a link they already used a week ago should be told it was used, not that it
    // aged out — the first is what happened and suggests no action, the second invites a retry.
    const r = checkToken({ purpose: "reset", expiresAt: NOW - 10_000, usedAt: NOW - 20_000 }, NOW);
    expect(r.usable).toBe(false);
    if (!r.usable) expect(r.reason).toBe("used");
  });

  it("words invite and reset failures differently", () => {
    const inv = checkToken({ purpose: "invite", expiresAt: NOW - 1, usedAt: null }, NOW);
    const res = checkToken({ purpose: "reset", expiresAt: NOW - 1, usedAt: null }, NOW);
    expect(inv.usable).toBe(false);
    expect(res.usable).toBe(false);
    if (!inv.usable && !res.usable) expect(inv.message).not.toBe(res.message);
  });
});

describe("token lifetimes", () => {
  it("gives an invite far longer than a reset", () => {
    expect(TOKEN_POLICY.invite.ttlMs).toBeGreaterThan(TOKEN_POLICY.reset.ttlMs * 24);
  });

  it("keeps a reset link to an hour", () => {
    expect(TOKEN_POLICY.reset.ttlMs).toBe(60 * 60_000);
  });
});

describe("validatePassword", () => {
  it("accepts an ordinary long passphrase", () => {
    expect(validatePassword("correct horse battery staple")).toEqual({ ok: true });
  });

  it("rejects anything under the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1)).ok).toBe(false);
  });

  it("accepts exactly the minimum", () => {
    expect(validatePassword("zqf" + "x".repeat(PASSWORD_MIN_LENGTH - 3)).ok).toBe(true);
  });

  it("rejects the platform's own shared password and anything built on it", () => {
    expect(validatePassword("revio1234").ok).toBe(false);
    expect(validatePassword("revio1234!!").ok).toBe(false);
  });

  it("rejects a password containing the account's own email name", () => {
    expect(validatePassword("konstantin2026", { email: "konstantin@hotel.com" }).ok).toBe(false);
  });

  it("does not reject on a very short email local part", () => {
    // "jo" appearing inside a passphrase is coincidence, not reuse.
    expect(validatePassword("enjoyable weather today", { email: "jo@hotel.com" }).ok).toBe(true);
  });

  it("rejects absurdly long input rather than hashing it", () => {
    expect(validatePassword("x".repeat(500)).ok).toBe(false);
  });

  it("does not demand digits, symbols or capitals", () => {
    // Composition rules reliably produce "Password1!". Length buys more.
    expect(validatePassword("thequickbrownfox").ok).toBe(true);
  });
});

describe("auth emails", () => {
  const base = { context: "Hotel Sofia", url: "https://example.com/t/abc123" };

  it("names who invited you — an unexplained password link is indistinguishable from phishing", () => {
    const e = inviteEmail({ ...base, name: "Lena", invitedBy: "Konstantin" });
    expect(e.text).toContain("Konstantin");
    expect(e.text).toContain("Hotel Sofia");
    expect(e.text).toContain(base.url);
  });

  it("still reads correctly with no name and no inviter", () => {
    const e = inviteEmail(base);
    expect(e.text).toContain("Hello,");
    expect(e.text).toContain("You have been added");
  });

  it("states how long each link lasts", () => {
    expect(inviteEmail(base).text).toContain(TOKEN_POLICY.invite.ttlLabel);
    expect(passwordResetEmail(base).text).toContain(TOKEN_POLICY.reset.ttlLabel);
  });

  it("never confirms that an account exists — the reset mail is identical for an unknown address", () => {
    const e = passwordResetEmail(base);
    expect(e.text).toContain("Someone asked to reset");
    expect(e.text.toLowerCase()).not.toContain("your account was found");
    expect(e.text.toLowerCase()).not.toContain("no account");
  });

  it("tells a recipient who did not request it that nothing has changed", () => {
    expect(passwordResetEmail(base).text).toContain("your password has not changed");
  });

  it("makes the after-the-fact notice alarming when unexpected", () => {
    const e = passwordChangedEmail({ context: "Hotel Sofia" });
    expect(e.subject).toContain("changed");
    expect(e.text).toContain("someone else has access");
  });

  it("carries no HTML or remote images", () => {
    for (const e of [inviteEmail(base), passwordResetEmail(base), passwordChangedEmail(base)]) {
      expect(e.text).not.toMatch(/<[a-z]/i);
      expect(e.text).not.toContain("<img");
    }
  });
});
