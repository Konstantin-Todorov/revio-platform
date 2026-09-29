import { describe, expect, it } from "vitest";
import { negotiateGuestLanguage } from "./guest-language.js";

describe("negotiateGuestLanguage", () => {
  it("honours the guest's own pick above everything", () => {
    expect(negotiateGuestLanguage({ chosen: "en", acceptLanguage: "bg-BG,bg", fallback: "bg" })).toBe("en");
  });

  it("reads the whole browser list — a German browser that also accepts English gets English, not the hotel's default", () => {
    expect(negotiateGuestLanguage({ acceptLanguage: "de-DE,de;q=0.9,en;q=0.8", fallback: "bg" })).toBe("en");
  });

  it("respects the browser's weights, not only its order", () => {
    expect(negotiateGuestLanguage({ acceptLanguage: "en;q=0.3,bg;q=0.9", fallback: "en" })).toBe("bg");
  });

  it("falls back to the hotel's language when the browser names nothing we speak", () => {
    expect(negotiateGuestLanguage({ acceptLanguage: "ja,zh;q=0.8", fallback: "bg" })).toBe("bg");
  });

  it("ignores a language we do not send in, wherever it comes from", () => {
    expect(negotiateGuestLanguage({ chosen: "fr", fallback: "de" })).toBe("en");
  });
});
