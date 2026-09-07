import { describe, it, expect } from "vitest";
import { HELP_ARTICLES, HELP_BY_ID, HELP_CATEGORIES } from "./articles";
import { searchHelp, scoreArticle, helpForProduct } from "./search";

describe("the content itself", () => {
  it("has a unique, stable id for every article", () => {
    // Ids are cited in URLs and by the assistant. A duplicate silently shadows an answer.
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(HELP_BY_ID)).toHaveLength(HELP_ARTICLES.length);
  });

  it("never publishes an answer with no product", () => {
    // An article nobody can reach is worse than a missing one: it looks like coverage.
    for (const a of HELP_ARTICLES) expect(a.products.length).toBeGreaterThan(0);
  });

  it("uses only categories the browse view can render", () => {
    const known = new Set(HELP_CATEGORIES.map((c) => c.key));
    for (const a of HELP_ARTICLES) expect(known.has(a.category)).toBe(true);
  });

  it("writes routes as absolute paths, so prefix matching works", () => {
    for (const a of HELP_ARTICLES) {
      for (const r of a.routes ?? []) expect(r.startsWith("/")).toBe(true);
    }
  });

  it("gives every category at least one answer", () => {
    for (const c of HELP_CATEGORIES) {
      expect(HELP_ARTICLES.some((a) => a.category === c.key)).toBe(true);
    }
  });

  it("answers something in every product", () => {
    for (const p of ["cm", "crs", "pms"] as const) {
      expect(helpForProduct(p).length).toBeGreaterThan(0);
    }
  });
});

describe("searchHelp — the screen outranks the words", () => {
  it("answers with nothing typed, from the route alone", () => {
    // The whole point: useful suggestions before somebody writes anything.
    const hits = searchHelp({ product: "cm", route: "/mapping" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.id).toBe("trouble-not-on-booking-com");
  });

  it("lets the route beat a keyword match somewhere else", () => {
    const hits = searchHelp({ product: "cm", route: "/mapping", text: "not showing" });
    expect(hits[0]!.id).toBe("trouble-not-on-booking-com");
  });

  it("matches a route prefix, so a sub-page still finds its answer", () => {
    const hits = searchHelp({ product: "crs", route: "/settings/taxes" });
    expect(hits.map((h) => h.id)).toContain("where-taxes");
  });

  it("never shows an answer that is wrong for the product", () => {
    // The check-out block is a RevioPMS behaviour; offering it in RevioLink would mislead.
    const hits = searchHelp({ product: "cm", text: "check out balance" });
    expect(hits.map((h) => h.id)).not.toContain("trouble-cannot-check-out");
  });

  it("finds an answer by a word the question does not contain", () => {
    const hits = searchHelp({ product: "crs", text: "vat" });
    expect(hits.map((h) => h.id)).toContain("where-taxes");
  });

  it("returns nothing rather than everything when it does not understand", () => {
    // A list of unrelated articles reads as "we did not understand you".
    expect(searchHelp({ product: "crs", text: "zzzzqqq nonsense" })).toEqual([]);
  });

  it("ignores words too short to carry meaning", () => {
    expect(searchHelp({ product: "crs", text: "is a of" })).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchHelp({ product: "crs", text: "price" }, 2).length).toBeLessThanOrEqual(2);
  });
});

describe("scoreArticle", () => {
  const article = HELP_BY_ID["where-prices"]!;

  it("refuses an article from another product", () => {
    expect(scoreArticle(article, { product: "pms" })).toBe(-1);
  });

  it("scores a route hit above any single word", () => {
    const byRoute = scoreArticle(article, { product: "crs", route: "/rooms-rates" });
    const byWord = scoreArticle(article, { product: "crs", text: "price" });
    expect(byRoute).toBeGreaterThan(byWord);
  });

  it("does not treat an unrelated search on the right screen as a match", () => {
    // Being on the page is not a reason to answer a question about something else.
    const s = scoreArticle(article, { product: "crs", route: "/rooms-rates", text: "zzzz" });
    expect(s).toBe(0);
  });
});
