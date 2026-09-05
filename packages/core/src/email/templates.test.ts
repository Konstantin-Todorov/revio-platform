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
    const html = render("sans", theme);
    expect(html.match(SERIF)).toBeNull();
    // Both directions. `SANS` was declared here and never asserted on, so this test proved the serif
    // font was absent without ever proving the sans one arrived — an email with no font-family at all
    // would have passed it.
    expect(html.match(SANS)!.length).toBeGreaterThan(0);
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

describe("renderEmail — the rating ask", () => {
  const brand = { propertyName: "Hotel Sofia", senderName: null, replyTo: null, logoUrl: null, brandColor: "#2b5cff", footerText: null, theme: "classic", font: "sans" };
  const urls = [1, 2, 3, 4, 5].map((n) => `https://book.example.com/feedback/tok/${n}`);

  const render = (over = {}) =>
    renderEmail({
      subject: "Thank you",
      body: "Dear guest,\n\nThank you for staying.",
      brand: brand as never,
      vars: {},
      rating: { question: "How was your stay at Hotel Sofia?", urls, hint: "One tap.", ...over },
    });

  it("puts all five links in the HTML", () => {
    const html = render().html;
    for (const url of urls) expect(html).toContain(url);
  });

  it("puts all five links in the plain text too", () => {
    // A text part that omits the ask makes the email unanswerable for anyone reading text-only.
    const text = render().text;
    for (const url of urls) expect(text).toContain(url);
  });

  it("numbers the stars, so a guest can tell which one they are pressing", () => {
    const html = render().html;
    // Five glyphs alone give no way to aim, and a client that cannot render ★ shows five boxes.
    for (const n of ["1", "2", "3", "4", "5"]) expect(html).toContain(`>${n}</span>`);
  });

  it("labels each text row with n/5 rather than relying on the glyphs", () => {
    const text = render().text;
    expect(text).toContain("1/5");
    expect(text).toContain("5/5");
    expect(text).toContain("★★★★★");
  });

  it("asks the question in both parts", () => {
    const out = render();
    expect(out.text).toContain("How was your stay at Hotel Sofia?");
    expect(out.html).toContain("How was your stay at Hotel Sofia?");
  });

  it("carries the hint when given and omits it when not", () => {
    expect(render().text).toContain("One tap.");
    const noHint = renderEmail({
      subject: "T", body: "B", brand: brand as never, vars: {},
      rating: { question: "Q", urls },
    });
    expect(noHint.text).not.toContain("undefined");
  });

  it("refuses a scale that is not five points", () => {
    // A four-star row silently changes what the average means. Better to fail loudly at render.
    expect(() =>
      renderEmail({
        subject: "T", body: "B", brand: brand as never, vars: {},
        rating: { question: "Q", urls: urls.slice(0, 4) },
      }),
    ).toThrow();
  });

  it("escapes a hostile question rather than injecting it", () => {
    const out = renderEmail({
      subject: "T", body: "B", brand: brand as never, vars: {},
      rating: { question: '<script>alert(1)</script>', urls },
    });
    expect(out.html).not.toContain("<script>");
  });

  it("changes nothing when no rating is asked", () => {
    const plain = renderEmail({ subject: "T", body: "Body here.", brand: brand as never, vars: {} });
    expect(plain.html).not.toContain("★");
    expect(plain.text).not.toContain("★");
  });
});
