import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { nextHidden, parseHidden, visibleColumns, type ColumnDef } from "@revio/ui/column-visibility";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));

import { ReservationsTable, type ResRow } from "@/components/reservations/ReservationsTable";

const COLS: ColumnDef[] = [
  { key: "guest", label: "Guest", locked: true },
  { key: "stay", label: "Stay" },
  { key: "total", label: "Total" },
];

describe("visibleColumns", () => {
  it("keeps everything when nothing is hidden", () => {
    expect(visibleColumns(COLS, new Set()).map((c) => c.key)).toEqual(["guest", "stay", "total"]);
  });

  it("drops a hidden column and keeps the order of the rest", () => {
    expect(visibleColumns(COLS, new Set(["stay"])).map((c) => c.key)).toEqual(["guest", "total"]);
  });

  it("a locked column survives even if the stored value says to hide it", () => {
    // The table renders locked columns regardless; anything else would let a stale stored value
    // remove the link out of every row.
    expect(visibleColumns(COLS, new Set(["guest", "stay", "total"])).map((c) => c.key)).toEqual(["guest"]);
  });
});

describe("parseHidden", () => {
  it("reads back a stored list", () => {
    expect([...parseHidden('["stay"]', COLS)]).toEqual(["stay"]);
  });

  it("treats every kind of junk as nothing hidden", () => {
    for (const raw of [null, "", "not json", "{}", '"stay"', "42", "[1,2]"]) {
      expect(parseHidden(raw, COLS).size).toBe(0);
    }
  });

  it("drops a key no column has any more", () => {
    // A column renamed between releases must not leave an entry that hides its replacement.
    expect([...parseHidden('["stay","retired_column"]', COLS)]).toEqual(["stay"]);
  });

  it("drops a key that has since been locked", () => {
    expect(parseHidden('["guest"]', COLS).size).toBe(0);
  });

  it("⚠️ stores HIDDEN, so a column added later arrives visible", () => {
    // The whole reason the stored shape is "hidden" and not "visible": a reader who set their
    // columns last month must still see the column we ship this month, or it is a feature that
    // exists for nobody who has ever opened the menu, with no error to say so.
    const later: ColumnDef[] = [...COLS, { key: "source", label: "Source" }];
    const stored = JSON.stringify([...parseHidden('["stay"]', COLS)]);
    expect(visibleColumns(later, parseHidden(stored, later)).map((c) => c.key)).toEqual(["guest", "total", "source"]);
  });
});

describe("nextHidden", () => {
  it("toggles a hideable column both ways", () => {
    const on = nextHidden(new Set(), "stay", COLS);
    expect([...on]).toEqual(["stay"]);
    expect([...nextHidden(on, "stay", COLS)]).toEqual([]);
  });

  it("refuses to hide a locked column or an unknown one", () => {
    expect(nextHidden(new Set(), "guest", COLS).size).toBe(0);
    expect(nextHidden(new Set(), "nope", COLS).size).toBe(0);
  });

  it("never mutates the set it was given", () => {
    const before = new Set(["stay"]);
    nextHidden(before, "total", COLS);
    expect([...before]).toEqual(["stay"]);
  });
});

const ROWS: ResRow[] = [
  {
    id: "r1", guestName: "Ivanov", externalId: "BDC-1", checkIn: "2026-09-12", checkOut: "2026-09-14",
    roomTypeName: "Deluxe Double", quantity: 1, source: "Booking.com", totalMinor: 19500, currency: "EUR",
    status: "confirmed", bookedIso: "2026-09-01",
  },
];

describe("ReservationsTable, server-rendered", () => {
  const html = renderToStaticMarkup(<ReservationsTable rows={ROWS} />);

  it("shows every column on the first paint, before any stored preference lands", () => {
    // Reading storage during render would make the client's first tree differ from this one, and
    // React answers a mismatch by throwing the markup away. The preference applies a frame later.
    for (const label of ["Guest", "Stay", "Room", "Source", "Total", "Status", "Booked"]) {
      expect(html).toContain(label);
    }
  });

  it("has exactly as many body cells as heading cells", () => {
    // The defect this design exists to prevent: a hidden column taking its heading and leaving its
    // values (or the reverse), so every figure after it reads under the wrong title.
    const headings = (html.match(/<th\b/g) ?? []).length;
    const cells = (html.match(/<td\b/g) ?? []).length;
    expect(headings).toBe(7);
    expect(cells).toBe(headings * ROWS.length);
  });

  it("says how many rows there are and offers the picker", () => {
    expect(html).toContain("1 reservation");
    expect(html).toContain("Columns");
  });
});
