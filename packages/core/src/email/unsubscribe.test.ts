import { describe, expect, it } from "vitest";
import { EMAIL_OPT_IN, GUEST_MARKETING_EMAILS, renderEmail, unsubscribeFooter } from "./templates.js";

describe("the opt-out line on a promotional guest email", () => {
  const brand = { propertyName: "Hotel Sofia", theme: "modern", font: "sans" };
  const unsubscribe = { ...unsubscribeFooter("en", { propertyName: "Hotel Sofia", sender: "Sofia Hotels Ltd" }), url: "https://x.test/email/t?a=1&b=2" };

  it("names the hotel and who is sending", () => {
    expect(unsubscribe.notice).toContain("Hotel Sofia");
    expect(unsubscribe.notice).toContain("Sofia Hotels Ltd");
    // With no legal entity on file the hotel's own name stands in — never an empty "Sent by".
    expect(unsubscribeFooter("en", { propertyName: "Hotel Sofia" }).notice).toContain("Sent by Hotel Sofia");
  });

  it("is rendered in the plain text and as an escaped link in the HTML, in every theme", () => {
    for (const theme of ["classic", "modern", "minimal", "boutique"]) {
      const r = renderEmail({ subject: "s", body: "Hello", brand: { ...brand, theme }, vars: {}, unsubscribe });
      expect(r.text).toContain(unsubscribe.url);
      expect(r.html).toContain('href="https://x.test/email/t?a=1&amp;b=2"');
      expect(r.html).toContain(unsubscribe.label);
    }
  });

  it("is absent unless asked for", () => {
    const r = renderEmail({ subject: "s", body: "Hello", brand, vars: {} });
    expect(r.text).not.toContain("Unsubscribe");
    expect(r.html).not.toContain("Unsubscribe");
  });

  it("covers every scheduled email — the ones that reach a guest nobody at the hotel is dealing with", () => {
    for (const key of EMAIL_OPT_IN) expect(GUEST_MARKETING_EMAILS.has(key)).toBe(true);
  });
});
