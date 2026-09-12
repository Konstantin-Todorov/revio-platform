import { describe, it, expect } from "vitest";
import { filterChips, showClearAll } from "./filter-chips";

const LABELS = {
  check_in: "Check-in",
  check_out: "Check-out",
  created: "Reservation made on",
  cancelled: "Cancellation date",
  stay: "Staying on (in-house)",
};
const opts = { basePath: "/reservations", dateTypeLabels: LABELS };

describe("filterChips", () => {
  it("says nothing when nothing is filtering", () => {
    expect(filterChips({}, opts)).toEqual([]);
    expect(filterChips({ dateType: "check_in" }, opts)).toEqual([]);
  });

  it("rule 3 — a date type with no range is not a chip", () => {
    // The control has a value (it always does), but it is filtering nothing. A badge here would
    // teach the reader that badges do not mean anything.
    expect(filterChips({ dateType: "created" }, opts)).toEqual([]);
  });

  it("names the search in the reader's words", () => {
    const [chip] = filterChips({ q: "Ivanov" }, opts);
    expect(chip).toMatchObject({ key: "q", label: "Search", value: "Ivanov" });
  });

  it("says no_show as 'no show'", () => {
    const [chip] = filterChips({ status: "no_show" }, opts);
    expect(chip.value).toBe("no show");
  });

  it("rule 1 — a chip drops ONLY its own filter", () => {
    const chips = filterChips({ q: "Ivanov", status: "confirmed", from: "2026-09-01", to: "2026-09-30", dateType: "check_out" }, opts);
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c.href]));

    // Removing the search keeps status and the range, including which date the range is on.
    const q = new URL(byKey.q, "https://x").searchParams;
    expect(q.get("q")).toBeNull();
    expect(q.get("status")).toBe("confirmed");
    expect(q.get("from")).toBe("2026-09-01");
    expect(q.get("to")).toBe("2026-09-30");
    expect(q.get("dateType")).toBe("check_out");

    const st = new URL(byKey.status, "https://x").searchParams;
    expect(st.get("status")).toBeNull();
    expect(st.get("q")).toBe("Ivanov");
  });

  it("rule 2 — the range is one chip and removing it takes from, to AND dateType", () => {
    const chips = filterChips({ status: "confirmed", from: "2026-09-01", to: "2026-09-30", dateType: "check_out" }, opts);
    const date = chips.find((c) => c.key === "date")!;
    expect(chips.filter((c) => c.key === "date")).toHaveLength(1);
    expect(date.label).toBe("Check-out");
    expect(date.value).toBe("2026-09-01 → 2026-09-30");

    const p = new URL(date.href, "https://x").searchParams;
    // A half-removed range is a THIRD result set the reader never asked for.
    expect(p.get("from")).toBeNull();
    expect(p.get("to")).toBeNull();
    expect(p.get("dateType")).toBeNull();
    expect(p.get("status")).toBe("confirmed");
  });

  it("reads a one-sided range as open-ended rather than pretending it is a range", () => {
    expect(filterChips({ from: "2026-09-01" }, opts)[0].value).toBe("from 2026-09-01");
    expect(filterChips({ to: "2026-09-30" }, opts)[0].value).toBe("until 2026-09-30");
  });

  it("falls back to the default date label when dateType is absent or unknown", () => {
    expect(filterChips({ from: "2026-09-01" }, opts)[0].label).toBe("Check-in");
    expect(filterChips({ from: "2026-09-01", dateType: "nonsense" }, opts)[0].label).toBe("Check-in");
  });

  it("rule 4 — a lit segment tab IS the badge, so there are no chips", () => {
    const chips = filterChips(
      { dateType: "check_in", from: "2026-09-12", to: "2026-09-12" },
      { ...opts, segmentActive: true },
    );
    expect(chips).toEqual([]);
  });

  it("drops the query string entirely when the last filter is removed", () => {
    const [chip] = filterChips({ q: "Ivanov" }, opts);
    expect(chip.href).toBe("/reservations");
  });

  it("works from any base path", () => {
    const [chip] = filterChips({ q: "a", status: "confirmed" }, { ...opts, basePath: "/guests" });
    expect(chip.href.startsWith("/guests?")).toBe(true);
  });
});

describe("showClearAll", () => {
  it("stays away until there is more than one thing to clear", () => {
    expect(showClearAll(filterChips({ q: "a" }, opts))).toBe(false);
    expect(showClearAll(filterChips({ q: "a", status: "confirmed" }, opts))).toBe(true);
  });
});
