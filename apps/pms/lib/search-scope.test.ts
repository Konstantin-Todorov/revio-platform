import { describe, it, expect } from "vitest";
import type { SearchHit } from "@revio/core";
import { firstAllowed, visibleTo } from "./search-scope";

/** One of each kind the RevioPMS palette can return, at the hrefs it really uses. */
const HITS: SearchHit[] = [
  { id: "r1", kind: "reservation", title: "Maria Ivanova", subtitle: "2026-09-14 → 2026-09-17", href: "/reservation/r1" },
  { id: "g1", kind: "guest", title: "Maria Ivanova", subtitle: "maria@example.com", href: "/guests?q=Maria" },
  { id: "u1", kind: "unit", title: "214", subtitle: "Deluxe Double · Dirty", href: "/housekeeping" },
  { id: "p1", kind: "hotel", title: "Hotel Sofia", subtitle: "Europe/Sofia", href: "/settings" },
  { id: "pg1", kind: "page", title: "Folios & Billing", href: "/folios" },
  { id: "pg2", kind: "page", title: "Housekeeping", href: "/housekeeping" },
  { id: "pg3", kind: "page", title: "Staff & Access", href: "/users" },
];

const titles = (role: string) => visibleTo(role, HITS).map((h) => h.title);

describe("visibleTo", () => {
  it("⚠️ a housekeeper sees rooms and nothing else — not the guest, not the booking", () => {
    /*
     * The founder's scenario, pinned. It is deliberately asserted on the RESULT LIST rather than on
     * navigation: the row carries the guest's name and e-mail, so a palette that renders it and
     * merely blocks the click has already handed over the data it was meant to protect.
     */
    expect(titles("housekeeper")).toEqual(["214", "Housekeeping"]);
    expect(titles("housekeeper")).not.toContain("Maria Ivanova");
    expect(titles("housekeeper")).not.toContain("Folios & Billing");
  });

  it("an outlet/POS account sees neither rooms nor guests", () => {
    // Their whole job is posting a drink to a folio from one screen; everything else is somebody's
    // private information that happens to be in the same database.
    expect(titles("outlet_pos")).toEqual([]);
  });

  it("⚠️ maintenance reaches the room by its OWN screen, never the person sleeping in it", () => {
    /*
     * The room hit is written with the href `firstAllowed` picks for the role. A maintenance
     * technician may open `/rooms` and not `/housekeeping`, so a hard-coded cleaning-board link made
     * room 214 unfindable for the one person sent to fix it — while correctly hiding the guest.
     * A scope filter is only right if it still lets the work happen.
     */
    const forMaintenance = HITS.map((h) =>
      h.kind === "unit" ? { ...h, href: firstAllowed("maintenance", ["/housekeeping", "/rooms"]) ?? "/housekeeping" } : h);
    expect(visibleTo("maintenance", forMaintenance).map((h) => h.title)).toEqual(["214"]);
    expect(visibleTo("maintenance", forMaintenance).map((h) => h.title)).not.toContain("Maria Ivanova");
    expect(firstAllowed("maintenance", ["/housekeeping", "/rooms"])).toBe("/rooms");
    expect(firstAllowed("housekeeper", ["/housekeeping", "/rooms"])).toBe("/housekeeping");
    // A role with no room screen at all gets no link to invent one.
    expect(firstAllowed("outlet_pos", ["/housekeeping", "/rooms"])).toBeNull();
  });

  it("a manager sees everything, so the filter is not just refusing everyone", () => {
    // A guard that denies indiscriminately passes every negative test and breaks the product.
    expect(visibleTo("manager", HITS)).toHaveLength(HITS.length);
    expect(visibleTo("owner", HITS)).toHaveLength(HITS.length);
  });

  it("⚠️ a commercial role gets NOTHING here, rather than everything", () => {
    // `roleAllowsPath` used to end `if (!allowed) return true`, so a role RevioPMS had never heard
    // of was treated as a manager: someone hired to price rooms could read folios and guest
    // identity documents. This is that fault, asserted from the search side.
    for (const role of ["revenue_manager", "distribution_manager", "read_only"]) {
      expect(titles(role)).toEqual([]);
    }
  });

  it("default-denies a role nobody has mapped", () => {
    expect(titles("night_auditor")).toEqual([]);
    expect(titles("")).toEqual([]);
  });
});
