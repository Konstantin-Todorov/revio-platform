import { describe, expect, it } from "vitest";
import { formatDay, formatMoney, resolveLocale, translate, translationCoverage, type Translations } from "@revio/ui/i18n";

type S = { nav: { desk: string; rooms: string }; count: (n: number) => string };
const dict: Translations<S> = {
  en: { nav: { desk: "Front Desk", rooms: "Rooms" }, count: (n) => `${n} rooms` },
  bg: { nav: { desk: "Рецепция" } },
};

describe("translate — a missing translation can never break a screen", () => {
  it("lays Bulgarian over English and falls back per key", () => {
    const t = translate(dict, "bg");
    expect(t.nav.desk).toBe("Рецепция");
    expect(t.nav.rooms).toBe("Rooms");
    expect(t.count(2)).toBe("2 rooms");
  });
  it("an empty Bulgarian string is 'not translated', not a blank label", () => {
    expect(translate({ en: { a: "Rooms" }, bg: { a: "" } }, "bg").a).toBe("Rooms");
  });
  it("English is the English dictionary untouched", () => {
    expect(translate(dict, "en")).toBe(dict.en);
  });
});

describe("translationCoverage", () => {
  it("names each untranslated key by its path", () => {
    expect(translationCoverage(dict)).toEqual({ total: 3, translated: 1, missing: ["nav.rooms", "count"] });
  });
});

describe("resolveLocale", () => {
  it("takes the first real locale — person, then cookie, then English", () => {
    expect(resolveLocale(null, "bg")).toBe("bg");
    expect(resolveLocale("en", "bg")).toBe("en");
    expect(resolveLocale("de", undefined)).toBe("en");
  });
});

describe("formatting speaks the reader's language", () => {
  it("writes money the Bulgarian way — comma decimals, and grouping only from five digits (CLDR)", () => {
    const norm = (s: string) => s.replace(/\s/g, " ");
    expect(norm(formatMoney(123450, "EUR", "bg"))).toBe("1234,50 €");
    expect(norm(formatMoney(1234500, "EUR", "bg"))).toBe("12 345,00 €");
  });
  it("formats a calendar day as that day in either language", () => {
    expect(formatDay("2026-09-24", "bg")).toMatch(/24/);
    expect(formatDay("2026-09-24", "en")).toMatch(/24 Sept? 2026/);
  });
});
