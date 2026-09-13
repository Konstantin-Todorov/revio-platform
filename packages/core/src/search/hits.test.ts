import { describe, it, expect } from "vitest";
import {
  groupHits, isSearchable, matchScore, rankHits, scoreHit, shortcutLabel, type SearchHit,
} from "./hits.js";

const hit = (over: Partial<SearchHit> & Pick<SearchHit, "title" | "kind">): SearchHit => ({
  id: over.title, href: "#", ...over,
});

describe("matchScore", () => {
  it("puts a whole-field match above a word start above a substring", () => {
    const exact = matchScore("BAR", "BAR");
    const start = matchScore("BAR Flexible", "BAR");
    // ⚠️ Genuinely inside a word. "Summer BARgain" was the first example here and it is NOT one —
    // "bargain" begins with "bar" at a word boundary, so it scores in the word-start tier, exactly
    // as it should. The test was wrong about its own example, not the ranking.
    const inside = matchScore("Seabar Lounge", "bar");
    expect(exact).toBeGreaterThan(start);
    expect(start).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(0);
  });

  it("finds a word in the middle, not only at the start", () => {
    // "Double" must find "Deluxe Double" — people type the distinguishing word, not the first one.
    expect(matchScore("Deluxe Double", "double")).toBeGreaterThanOrEqual(70);
  });

  it("treats a dash or a dot as a word boundary", () => {
    for (const f of ["Deluxe-Double", "Deluxe · Double", "Deluxe, Double"]) {
      expect(matchScore(f, "double")).toBeGreaterThanOrEqual(70);
    }
  });

  it("⚠️ prefers the shorter field within a tier", () => {
    // "BAR" is more likely the plan itself than the one named after it.
    expect(matchScore("BAR", "bar")).toBeGreaterThan(matchScore("BAR Non-Refundable Winter 2027", "bar"));
  });

  it("is zero when it does not appear at all, and zero for an empty query", () => {
    expect(matchScore("Deluxe Double", "suite")).toBe(0);
    expect(matchScore("Deluxe Double", "   ")).toBe(0);
    expect(matchScore("", "double")).toBe(0);
  });

  it("ignores case and surrounding space", () => {
    expect(matchScore("  Deluxe Double ", "  DELUXE  ".trim())).toBeGreaterThan(0);
  });

  it("survives a query full of regex characters", () => {
    // A search box takes whatever somebody types. `(` must not throw.
    expect(() => matchScore("Room (annexe)", "(annexe)")).not.toThrow();
    expect(matchScore("Room (annexe)", "(annexe)")).toBeGreaterThan(0);
  });
});

describe("scoreHit", () => {
  it("scores a subtitle match lower than the same match in the title", () => {
    const inTitle = scoreHit(hit({ kind: "room", title: "Deluxe Double" }), "deluxe");
    const inSub = scoreHit(hit({ kind: "room", title: "Room 204", subtitle: "Deluxe Double" }), "deluxe");
    expect(inTitle).toBeGreaterThan(inSub);
    expect(inSub).toBeGreaterThan(0);
  });
});

describe("rankHits", () => {
  const hits: SearchHit[] = [
    hit({ kind: "rate", title: "BAR Flexible" }),
    hit({ kind: "reservation", title: "BAR-9931", subtitle: "Maria Ivanova" }),
    hit({ kind: "guest", title: "Barbara Klein" }),
    hit({ kind: "room", title: "Bar Suite" }),
  ];

  it("⚠️ groups before it scores — the list keeps its SHAPE between keystrokes", () => {
    /*
     * Sorting by score alone looks smarter and reads worse: guests interleave with rate plans, so
     * the list reshuffles its shape on every keystroke and the eye can never settle. A reservation
     * always comes before a rate plan, whatever the two scores are.
     */
    expect(rankHits(hits, "bar").map((h) => h.kind)).toEqual(["reservation", "guest", "room", "rate"]);
  });

  it("drops everything that does not match", () => {
    expect(rankHits(hits, "penthouse")).toEqual([]);
  });

  it("caps the list, because a palette is not a results page", () => {
    const many = Array.from({ length: 40 }, (_, i) => hit({ kind: "room", title: `Room ${i}` }));
    expect(rankHits(many, "room")).toHaveLength(12);
    expect(rankHits(many, "room", 5)).toHaveLength(5);
  });

  it("breaks a tie on the title, so the order never wobbles between identical scores", () => {
    const tied = [hit({ kind: "room", title: "Zulu room" }), hit({ kind: "room", title: "Alpha room" })];
    expect(rankHits(tied, "room").map((h) => h.title)).toEqual(["Alpha room", "Zulu room"]);
    // And the same input in the other order gives the same output — that is what "stable" means.
    expect(rankHits([...tied].reverse(), "room").map((h) => h.title)).toEqual(["Alpha room", "Zulu room"]);
  });
});

describe("the operator's own kinds", () => {
  it("⚠️ a client outranks everything, and a hotel is a hotel in every product", () => {
    /*
     * The operator console searches a different world: its top entity is a CLIENT (one of our
     * customers), and `hotel` there means one of that client's buildings — the same thing `hotel`
     * means in the three hotel products. Getting this wrong is not cosmetic: an earlier draft sent
     * properties through as `room` and owners as `guest`, so the palette headed a list of hotels
     * "Room types" and a list of owners "Guests".
     */
    const hits: SearchHit[] = [
      hit({ kind: "invoice", title: "Sofia invoice 2026-0042" }),
      hit({ kind: "page", title: "Sofia section" }),
      hit({ kind: "person", title: "Sofia Petrova" }),
      hit({ kind: "hotel", title: "Hotel Sofia" }),
      hit({ kind: "client", title: "Sofia Group" }),
    ];
    expect(rankHits(hits, "sofia").map((h) => h.kind)).toEqual(["client", "hotel", "person", "invoice", "page"]);
  });

  it("labels them as an operator would say them", () => {
    const g = groupHits(rankHits([
      hit({ kind: "client", title: "Sofia Group" }),
      hit({ kind: "person", title: "Sofia Petrova" }),
    ], "sofia"));
    expect(g.map((x) => x.label)).toEqual(["Clients", "People"]);
  });

  it("⚠️ adding kinds did not reorder what a HOTEL sees", () => {
    // The rank numbers all changed when `client` and `person` were inserted. What must not change is
    // the order the three hotel products already depend on.
    const hotelHits: SearchHit[] = [
      hit({ kind: "page", title: "Sea page" }),
      hit({ kind: "channel", title: "Sea channel" }),
      hit({ kind: "rate", title: "Sea rate" }),
      hit({ kind: "unit", title: "Sea unit" }),
      hit({ kind: "room", title: "Sea room" }),
      hit({ kind: "hotel", title: "Sea hotel" }),
      hit({ kind: "guest", title: "Sea guest" }),
      hit({ kind: "reservation", title: "Sea reservation" }),
    ];
    expect(rankHits(hotelHits, "sea").map((h) => h.kind)).toEqual(
      ["reservation", "guest", "hotel", "room", "unit", "rate", "channel", "page"],
    );
  });
});

describe("groupHits", () => {
  it("heads each run and keeps the ranked order", () => {
    const g = groupHits(rankHits([
      hit({ kind: "guest", title: "Ana Petrova" }),
      hit({ kind: "guest", title: "Ana Dimitrova" }),
      hit({ kind: "room", title: "Ana suite" }),
    ], "ana"));
    expect(g.map((x) => [x.label, x.hits.length])).toEqual([["Guests", 2], ["Room types", 1]]);
  });

  it("is empty for no hits rather than a group with nothing in it", () => {
    expect(groupHits([])).toEqual([]);
  });
});

describe("shortcutLabel", () => {
  it("⚠️ says ⌘ on a Mac and Ctrl everywhere else", () => {
    // The wrong modifier is small, and it is exactly the kind of small that tells somebody nobody
    // checked the thing they are being asked to trust with a hotel's bookings.
    for (const p of ["MacIntel", "iPhone", "iPad"]) expect(shortcutLabel(p)).toBe("⌘K");
    for (const p of ["Win32", "Linux x86_64", ""]) expect(shortcutLabel(p)).toBe("Ctrl K");
  });
});

describe("isSearchable", () => {
  it("waits for two characters before asking the database", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("an")).toBe(true);
    expect(isSearchable("")).toBe(false);
  });
});
