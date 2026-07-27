import { describe, expect, it } from "vitest";
import { isValidSlug, proposeSlug, slugRejectionReason, slugifyPropertyName } from "./slug.js";

describe("slugifyPropertyName", () => {
  it("handles the ordinary case", () => {
    expect(slugifyPropertyName("Hotel Sofia")).toBe("hotel-sofia");
    expect(slugifyPropertyName("  Grand   Hotel  ")).toBe("grand-hotel");
  });

  it("transliterates Cyrillic instead of erasing it", () => {
    // The whole reason transliteration exists: a naive [^a-z0-9] filter turns this into "".
    expect(slugifyPropertyName("Хотел София")).toBe("hotel-sofiya");
    expect(slugifyPropertyName("Черно море")).toBe("cherno-more");
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugifyPropertyName("Café Rosé")).toBe("cafe-rose");
  });

  it("never produces leading, trailing or doubled hyphens", () => {
    for (const name of ["  -Hotel-  ", "Hotel — Sofia", "!!!Hotel!!!", "A  &  B"]) {
      const s = slugifyPropertyName(name);
      expect(s.startsWith("-"), name).toBe(false);
      expect(s.endsWith("-"), name).toBe(false);
      expect(s.includes("--"), name).toBe(false);
    }
  });

  it("truncates without leaving a trailing hyphen", () => {
    const s = slugifyPropertyName("A".repeat(60) + " Hotel");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs", () => {
    expect(isValidSlug("hotel-sofia")).toBe(true);
    expect(isValidSlug("h2o")).toBe(true);
  });

  it("rejects our own route names", () => {
    // A hotel slug of "api" or "login" would shadow real routes.
    for (const r of ["api", "login", "admin", "book", "operator", "www"]) {
      expect(isValidSlug(r), r).toBe(false);
    }
  });

  it("rejects malformed shapes", () => {
    for (const bad of ["ab", "-hotel", "hotel-", "hotel--sofia", "Hotel", "hotel sofia", "hotel_sofia", ""]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
  });

  it("gives a reason for every rejection it makes", () => {
    for (const bad of ["ab", "api", "hotel--x", "A".repeat(50)]) {
      expect(slugRejectionReason(bad), bad).toBeTruthy();
    }
    expect(slugRejectionReason("hotel-sofia")).toBeNull();
  });
});

describe("proposeSlug", () => {
  it("returns the clean slug when it is free", () => {
    expect(proposeSlug("Hotel Sofia", new Set())).toBe("hotel-sofia");
  });

  it("suffixes readably rather than randomly when taken", () => {
    expect(proposeSlug("Hotel Sofia", new Set(["hotel-sofia"]))).toBe("hotel-sofia-2");
    expect(proposeSlug("Hotel Sofia", new Set(["hotel-sofia", "hotel-sofia-2"]))).toBe("hotel-sofia-3");
  });

  it("never proposes a reserved word, even from a matching name", () => {
    const s = proposeSlug("API", new Set());
    expect(isValidSlug(s)).toBe(true);
    expect(s).not.toBe("api");
  });

  it("always returns something valid, even for hostile input", () => {
    for (const name of ["!!!", "   ", "至高酒店", "-", "a"]) {
      const s = proposeSlug(name, new Set());
      expect(isValidSlug(s), `${name} → ${s}`).toBe(true);
    }
  });

  it("keeps the suffix inside the length limit", () => {
    const long = "A".repeat(60);
    const taken = new Set([slugifyPropertyName(long)]);
    const s = proposeSlug(long, taken);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(isValidSlug(s)).toBe(true);
  });
});
