import { describe, expect, it } from "vitest";
import { EMAIL_FONTS, EMAIL_THEMES, renderEmail, type EmailBrand } from "./templates.js";

/**
 * The typeface setting is the one branding control with no visible feedback until a real email
 * lands in someone's inbox, so it is the easiest one to leave silently broken — which is exactly
 * what happened: the renderer resolved the fonts correctly and then hardcoded sans into ten of its
 * sixteen declarations, so choosing "Serif" changed the masthead and nothing else.
 *
 * These assert the setting actually reaches the rendered HTML, in every theme.
 */

const SERIF = /font-family:Georgia/g;
const SANS = /font-family:'Helvetica Neue'/g;

function render(font: string, theme: string): string {
  const brand: EmailBrand = {
    propertyName: "Hotel Sofia",
    brandColor: "#0E7C86",
    theme,
    font,
    footerText: "Hotel Sofia · Sofia, Bulgaria",
  };
  return renderEmail({
    subject: "Your booking is confirmed",
    body: "Dear {{guestName}},\n\nWe look forward to welcoming you.\n\n{{details}}",
    vars: { guestName: "Maria Ivanova" },
    details: [
      { label: "Check-in", value: "5 August" },
      { label: "Total", value: "EUR 282.98", emphasis: true },
    ],
    cta: { label: "View your booking", url: "https://example.test/b/1" },
    brand,
  }).html;
}

const THEMES = EMAIL_THEMES.map((t) => t.key);

describe("email typeface setting", () => {
  it("offers exactly the three choices the settings screen renders", () => {
    expect(EMAIL_FONTS.map((f) => f.key)).toEqual(["serif", "sans", "mixed"]);
  });

  it.each(THEMES)("'sans' leaves no serif anywhere in the %s theme", (theme) => {
    expect(render("sans", theme).match(SERIF)).toBeNull();
  });

  it.each(THEMES)("'serif' reaches the body, not just the masthead, in the %s theme", (theme) => {
    // Six was the old broken count's ceiling; a genuine serif email is well past it.
    expect(render("serif", theme).match(SERIF)!.length).toBeGreaterThanOrEqual(6);
  });

  it.each(THEMES)("'mixed' sets headings in serif and body in sans in the %s theme", (theme) => {
    const html = render("mixed", theme);
    expect(html.match(SERIF)!.length).toBeGreaterThan(0);
    // The body paragraph is the thing "mixed" promises to keep sans.
    expect(html).toContain("line-height:1.7;color:#313B4A;font-family:'Helvetica Neue'");
  });

  it.each(THEMES)("every choice produces different HTML in the %s theme", (theme) => {
    const [serif, sans, mixed] = [render("serif", theme), render("sans", theme), render("mixed", theme)];
    expect(new Set([serif, sans, mixed]).size).toBe(3);
  });

  it("keeps small uppercase labels in sans even for a serif hotel", () => {
    // Deliberate: Georgia at 10.5px with 0.14em tracking is harder to read, so the letterspaced
    // labels opt out. If this ever flips, it should be a decision rather than a regression.
    expect(render("serif", "boutique")).toContain("text-transform:uppercase;color:#9A8F7F;font-family:'Helvetica Neue'");
  });

  it("falls back to serif when a property has never chosen", () => {
    expect(render("", "classic")).toEqual(render("serif", "classic"));
  });
});
