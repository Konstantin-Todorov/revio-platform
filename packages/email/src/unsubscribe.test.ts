import { describe, expect, it, vi } from "vitest";
import { sendTemplatedEmail, type EmailDb, type EmailTemplateRow } from "./engine.js";

/**
 * A hotel's promotional guest mail ("Before arrival", "After departure") must always carry a way
 * out — in the footer for a person, and in the headers for the mail client's own button (RFC 8058).
 * A caller that forgets the link gets a refusal, never a bare promotional email.
 */

vi.mock("./transport.js", () => ({
  sendEmail: vi.fn(async () => ({ ok: true, mode: "mock" as const })),
}));
const { sendEmail } = await import("./transport.js");

const property = {
  id: "prop1", name: "Hotel Sofia", defaultLanguage: "en",
  emailSenderName: null, emailReplyTo: null, emailLogoUrl: null, emailLogoVersion: 0,
  emailBrandColor: "#0E7C86", emailFooterText: null, emailTheme: "classic", emailFont: "sans",
};

// The scheduled emails send only once the hotel has switched them on — a saved, enabled row.
const switchedOn: EmailTemplateRow[] = [
  { key: "post_stay", enabled: true, subject: "Thank you", body: "Come back and book direct." },
];
const db: EmailDb = {
  property: { findUnique: async () => property as never },
  emailTemplate: {
    findMany: async () => switchedOn,
    findUnique: async ({ where }) => switchedOn.find((r) => r.key === where.propertyId_key_locale.key) ?? null,
  },
} as EmailDb;

const base = { propertyId: "prop1", key: "post_stay", to: ["guest@example.test"], vars: { guestName: "Elena" } };
const unsubscribe = {
  url: "https://booking.example.test/email/tok_abcdefghijklmnopqrstuv",
  oneClickUrl: "https://booking.example.test/api/unsubscribe/tok_abcdefghijklmnopqrstuv",
  sender: "Хотел София ЕООД",
};

describe("promotional guest email", () => {
  it("is refused without an unsubscribe link, and nothing is sent", async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await sendTemplatedEmail(db, base);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsubscribe/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("carries the link in both parts, names the sender, and sets the one-click headers", async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await sendTemplatedEmail(db, { ...base, unsubscribe });
    expect(res.ok).toBe(true);
    const sent = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(sent.text).toContain(unsubscribe.url);
    expect(sent.text).toContain("Хотел София ЕООД");
    expect(sent.html).toContain(unsubscribe.url);
    expect(sent.headers).toEqual({
      "List-Unsubscribe": `<${unsubscribe.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("puts the opt-out outside the editable body, so a hotel's rewrite cannot remove it", async () => {
    vi.mocked(sendEmail).mockClear();
    await sendTemplatedEmail(db, { ...base, unsubscribe });
    const sent = vi.mocked(sendEmail).mock.calls[0]![0];
    // The hotel's body has no link; the rendered mail still does.
    expect(switchedOn[0]!.body).not.toContain("http");
    expect(sent.html).toContain("Unsubscribe from these emails");
  });

  it("speaks the guest's language", async () => {
    vi.mocked(sendEmail).mockClear();
    await sendTemplatedEmail(db, { ...base, locale: "bg", unsubscribe });
    expect(vi.mocked(sendEmail).mock.calls[0]![0].text).toContain("Не желая повече такива писма");
  });

  it("leaves a transactional email exactly as it was — no footer, no headers", async () => {
    vi.mocked(sendEmail).mockClear();
    await sendTemplatedEmail(db, { ...base, key: "booking_confirmation" });
    const sent = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(sent.headers).toBeUndefined();
    expect(sent.text).not.toContain("Unsubscribe");
  });
});
