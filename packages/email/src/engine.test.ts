import { describe, expect, it, vi } from "vitest";
import { sendTemplatedEmail, type EmailDb, type EmailTemplateRow } from "./engine.js";

/**
 * The resolution rules a hotel actually depends on:
 *  - a brand-new property with nothing configured still sends correct mail,
 *  - a hotel's own wording wins when they have written some,
 *  - a switched-off email is a deliberate no-op, not a failure,
 *  - and an unknown language falls back to English rather than sending nothing.
 *
 * The transport is mocked so these assert RESOLUTION, not delivery — sending is covered by the
 * transport's own mock mode, which is what runs without a provider key.
 */

vi.mock("./transport.js", () => ({
  sendEmail: vi.fn(async () => ({ ok: true, mode: "mock" as const })),
}));
const { sendEmail } = await import("./transport.js");

const property = {
  id: "prop1",
  name: "Hotel Sofia",
  defaultLanguage: "en",
  emailSenderName: null,
  emailReplyTo: null,
  emailLogoUrl: null,
  emailLogoVersion: 0,
  emailBrandColor: "#0E7C86",
  emailFooterText: null,
  emailTheme: "classic",
  emailFont: "sans",
};

function db(rows: EmailTemplateRow[] = [], prop: unknown = property): EmailDb {
  return {
    property: { findUnique: async () => prop as never },
    emailTemplate: {
      findMany: async () => rows,
      findUnique: async ({ where }) =>
        rows.find((r) => r.key === where.propertyId_key_locale.key) ?? null,
    },
  } as EmailDb;
}

const args = {
  propertyId: "prop1",
  key: "booking_confirmation",
  to: ["guest@example.test"],
  vars: { guestName: "Elena", propertyName: "Hotel Sofia", reference: "RV-ABC123" },
};

describe("sendTemplatedEmail", () => {
  it("sends the platform default when the hotel has configured nothing", async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await sendTemplatedEmail(db(), args);
    expect(res.ok).toBe(true);
    expect(res.skipped).toBeUndefined();
    const sent = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(sent.to).toEqual(["guest@example.test"]);
    // Placeholders must be filled, or the guest receives literal {{braces}}.
    expect(sent.subject).not.toContain("{{");
    expect(sent.text).toContain("Elena");
  });

  it("prefers the hotel's own wording over the default", async () => {
    vi.mocked(sendEmail).mockClear();
    await sendTemplatedEmail(
      db([{ key: "booking_confirmation", enabled: true, subject: "Welcome, {{guestName}}!", body: "See you soon." }]),
      args,
    );
    expect(vi.mocked(sendEmail).mock.calls[0]![0].subject).toBe("Welcome, Elena!");
  });

  it("treats a switched-off email as a deliberate skip, not a failure", async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await sendTemplatedEmail(
      db([{ key: "booking_confirmation", enabled: false, subject: "x", body: "y" }]),
      args,
    );
    // ok:true + skipped lets a caller tell "the hotel doesn't want this" from "sending broke".
    expect(res).toEqual({ ok: true, skipped: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not attempt to send with no recipients", async () => {
    vi.mocked(sendEmail).mockClear();
    const res = await sendTemplatedEmail(db(), { ...args, to: [] });
    expect(res).toEqual({ ok: true, skipped: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports an unknown template instead of silently sending nothing", async () => {
    const res = await sendTemplatedEmail(db(), { ...args, key: "not_a_template" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not_a_template");
  });

  it("reports an unknown property", async () => {
    const res = await sendTemplatedEmail(db([], null), args);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Unknown property");
  });

  it("still sends for a language the hotel has never customised", async () => {
    vi.mocked(sendEmail).mockClear();
    // A Bulgarian guest at a hotel with only English templates must get English, not silence.
    const res = await sendTemplatedEmail(db(), { ...args, locale: "bg" });
    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });
});
