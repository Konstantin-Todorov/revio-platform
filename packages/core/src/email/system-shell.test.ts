import { describe, it, expect } from "vitest";
import { renderSystemEmail, renderSystemEmailText, type SystemEmailArgs } from "./system-shell.js";
import { inviteEmail, passwordResetEmail, passwordChangedEmail } from "./auth-emails.js";

const base: SystemEmailArgs = {
  preview: "Choose a password.",
  heading: "You've been added",
  blocks: [
    { p: "Hello," },
    { action: { label: "Choose your password", url: "https://crs.reviosoft.app/set?t=abc" } },
    { note: "This link expires in 7 days." },
  ],
};

describe("renderSystemEmail — the security properties", () => {
  const html = renderSystemEmail(base);

  it("loads NO remote images — the reason plain text was chosen in the first place", () => {
    // Nothing to block, nothing to load, and no read receipt leaked from a password-reset mail.
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/background-image/i);
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(png|jpe?g|gif|webp|svg)/i);
  });

  it("pulls in no external stylesheet or font", () => {
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/@import/i);
  });

  it("shows the destination URL as text, not only as a button", () => {
    // Gateways rewrite and strip buttons; a URL somebody can read tells them where it goes BEFORE
    // they click, which is the most useful anti-phishing affordance an email has.
    const both = html.split("https://crs.reviosoft.app/set?t=abc").length - 1;
    expect(both).toBeGreaterThanOrEqual(2);
  });

  it("refuses a javascript: href rather than emitting it", () => {
    const evil = renderSystemEmail({
      ...base,
      blocks: [{ action: { label: "Click", url: "javascript:alert(1)" } }],
    });
    expect(evil).not.toContain("href=\"javascript:");
    expect(evil).not.toMatch(/href="javascript/i);
  });

  it("refuses a data: href too", () => {
    const evil = renderSystemEmail({
      ...base,
      blocks: [{ action: { label: "Click", url: "data:text/html,<script>x</script>" } }],
    });
    expect(evil).not.toMatch(/href="data:/i);
  });

  it("escapes HTML in copy rather than rendering it", () => {
    const x = renderSystemEmail({ ...base, heading: "<script>alert(1)</script>", blocks: [{ p: "a & b" }] });
    expect(x).not.toContain("<script>alert(1)</script>");
    expect(x).toContain("&lt;script&gt;");
    expect(x).toContain("a &amp; b");
  });
});

describe("renderSystemEmail — structure", () => {
  it("carries a preheader so the inbox preview is not the first stray words", () => {
    expect(renderSystemEmail(base)).toContain("Choose a password.");
  });

  it("names the product when given one, and stays platform-neutral when not", () => {
    expect(renderSystemEmail({ ...base, product: "RevioLink" })).toContain("RevioLink");
    // An invitation covers every product the hotel has, so naming one would contradict the copy.
    expect(renderSystemEmail(base)).not.toContain("RevioLink");
  });

  it("says 'if you weren't expecting this' ONCE, from the body and never from the footer", () => {
    // It read twice in every invitation: once in the body where it is specific, once in a vaguer
    // footer copy. The body owns it, because only the body knows what did not happen.
    const html = renderSystemEmail({
      ...base,
      blocks: [...base.blocks, { note: "If you weren't expecting this, ignore it." }],
    });
    expect(html.split("weren").length - 1).toBe(1);
    expect(renderSystemEmail(base)).not.toContain("nothing changes until the link above is used");
  });

  it("keeps a one-line footer on every email, link or not", () => {
    const digest = renderSystemEmail({ ...base, blocks: [{ list: ["A", "B"] }] });
    expect(digest).toContain("Sent by Revio, the software your property runs on.");
  });

  it("renders a list as table rows, not as a <ul>", () => {
    // Outlook's list indentation wraps a long guest name under the bullet instead of past it.
    const d = renderSystemEmail({ ...base, blocks: [{ list: ["Мария Иванова — Deluxe", "John Smith — Twin"] }] });
    expect(d).not.toContain("<ul");
    expect(d).toContain("Мария Иванова — Deluxe");
  });

  it("drops an empty list rather than leaving a stray panel", () => {
    expect(renderSystemEmail({ ...base, blocks: [{ list: [] }] })).not.toContain("f7f9fc");
  });

  it("is a complete document", () => {
    const html = renderSystemEmail(base);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });
});

describe("renderSystemEmailText — the fallback that must not be lost", () => {
  it("contains the link as bare text", () => {
    expect(renderSystemEmailText(base)).toContain("https://crs.reviosoft.app/set?t=abc");
  });
  it("keeps the notes, which carry the expiry and the 'ignore this' line", () => {
    expect(renderSystemEmailText(base)).toContain("This link expires in 7 days.");
  });
  it("signs off with the product when there is one", () => {
    expect(renderSystemEmailText({ ...base, product: "RevioLink" })).toContain("— RevioLink");
    expect(renderSystemEmailText(base)).toContain("— Revio");
  });
});

describe("the three auth emails", () => {
  const args = { name: "Mария", context: "Hotel Sofia", url: "https://pms.reviosoft.app/set?t=x" };

  it("all produce BOTH parts — the text fallback was never dropped", () => {
    for (const m of [inviteEmail(args), passwordResetEmail(args), passwordChangedEmail(args)]) {
      expect(m.subject.length).toBeGreaterThan(0);
      expect(m.text.length).toBeGreaterThan(0);
      expect(m.html).toContain("<!doctype html>");
    }
  });

  it("names who invited and to what — an unexplained link is indistinguishable from an attack", () => {
    const m = inviteEmail({ ...args, invitedBy: "Lena Koch" });
    expect(m.text).toContain("Lena Koch");
    expect(m.text).toContain("Hotel Sofia");
    expect(m.html).toContain("Lena Koch");
  });

  it("the reset never confirms an account exists", () => {
    // Same text for an address never seen: the alternative lets anyone enumerate a hotel's staff.
    const m = passwordResetEmail(args);
    expect(m.text.toLowerCase()).not.toContain("your account");
    expect(m.text).toContain("Someone asked to reset");
  });

  it("the reset and invite links reach the HTML part too", () => {
    expect(passwordResetEmail(args).html).toContain(args.url);
    expect(inviteEmail(args).html).toContain(args.url);
  });

  it("the password-changed mail has no link at all, so it cannot be a phishing template", () => {
    const m = passwordChangedEmail({ name: "A", context: "Hotel Sofia" });
    expect(m.html).not.toContain("<a href");
  });

  it("loads no images in any of them", () => {
    for (const m of [inviteEmail(args), passwordResetEmail(args), passwordChangedEmail(args)]) {
      expect(m.html).not.toMatch(/<img/i);
    }
  });
});
