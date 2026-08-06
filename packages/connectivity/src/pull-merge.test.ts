import { describe, expect, it } from "vitest";
import { decidePull, stayFingerprint, type IncomingStay, type Stay, type StayLine } from "./pull-merge.js";

const line = (o: Partial<StayLine> = {}): StayLine => ({
  roomTypeId: "rt-double",
  ratePlanId: "rp-bar",
  quantity: 1,
  checkIn: "2026-08-20",
  checkOut: "2026-08-22",
  priceMinor: 24_000,
  ...o,
});

const stay = (o: Partial<Stay> = {}): Stay => ({
  status: "confirmed",
  guestName: "Maria Ivanova",
  totalMinor: 24_000,
  currency: "EUR",
  lines: [line()],
  ...o,
});

const incoming = (o: Partial<IncomingStay> = {}): IncomingStay => ({ ...stay(), unmapped: false, ...o });

describe("decidePull", () => {
  it("imports a booking it has never seen", () => {
    expect(decidePull(null, incoming())).toBe("create");
  });

  it("APPLIES a modification that extends the stay and reprices it", () => {
    // The regression test for the bug that reached production: this returned "status only", so a
    // 2-night €240 booking modified to 3 nights €390 stayed 2 nights €240 in the database while
    // reading "modified" on screen — and the third night was never taken off the market.
    const action = decidePull(
      stay(),
      incoming({
        status: "modified",
        totalMinor: 39_000,
        lines: [line({ checkOut: "2026-08-23", priceMinor: 39_000 })],
      }),
    );
    expect(action).toBe("update");
  });

  it("applies a change of room type or rate plan", () => {
    expect(decidePull(stay(), incoming({ status: "modified", lines: [line({ roomTypeId: "rt-twin" })] }))).toBe("update");
    expect(decidePull(stay(), incoming({ status: "modified", lines: [line({ ratePlanId: "rp-breakfast" })] }))).toBe("update");
  });

  it("applies a price change even when the dates are identical", () => {
    expect(decidePull(stay(), incoming({ totalMinor: 26_000, lines: [line({ priceMinor: 26_000 })] }))).toBe("update");
  });

  it("applies a rename — the guest on the booking can change", () => {
    expect(decidePull(stay(), incoming({ guestName: "Maria Petrova" }))).toBe("update");
  });

  it("applies an added room", () => {
    expect(decidePull(stay(), incoming({ lines: [line(), line({ roomTypeId: "rt-twin" })] }))).toBe("update");
  });

  it("treats an identical re-send as unchanged", () => {
    // Channex re-delivers a revision until it is acknowledged. Re-writing the reservation each time
    // would churn the record and re-run the overbooking check for no reason.
    expect(decidePull(stay(), incoming())).toBe("unchanged");
  });

  it("is not fooled by line ORDER — Channex guarantees none", () => {
    const a = line({ roomTypeId: "rt-double" });
    const b = line({ roomTypeId: "rt-twin" });
    expect(decidePull(stay({ lines: [a, b] }), incoming({ lines: [b, a] }))).toBe("unchanged");
  });

  it("never resurrects a cancelled booking, whatever the revision says", () => {
    // The room may already have been resold. Terminal beats every other rule, including a revision
    // that looks like a fresh confirmation.
    for (const status of ["confirmed", "modified", "cancelled"]) {
      expect(decidePull(stay({ status: "cancelled" }), incoming({ status, totalMinor: 99_000 }))).toBe("terminal-cancelled");
    }
  });

  it("HOLDS the existing stay when a modification cannot be mapped", () => {
    // Replacing good lines with nothing would erase the stay and hand the rooms back to inventory.
    // Flag it for a human instead.
    expect(decidePull(stay(), incoming({ unmapped: true, lines: [] }))).toBe("unmapped-hold");
    expect(decidePull(stay(), incoming({ unmapped: true, lines: [line()] }))).toBe("unmapped-hold");
    expect(decidePull(stay(), incoming({ unmapped: false, lines: [] }))).toBe("unmapped-hold");
  });

  it("checks cancelled BEFORE mappability, so a cancel always lands", () => {
    // A cancellation for a booking whose mapping was since deleted must still be terminal rather
    // than parked as an unmapped problem.
    expect(decidePull(stay({ status: "cancelled" }), incoming({ status: "cancelled", unmapped: true, lines: [] }))).toBe("terminal-cancelled");
  });

  it("recognises the cancellation of a live booking as a real change", () => {
    expect(decidePull(stay(), incoming({ status: "cancelled" }))).toBe("update");
  });
});

describe("stayFingerprint", () => {
  it("changes when any part of the stay changes", () => {
    const base = stayFingerprint(stay());
    expect(stayFingerprint(stay({ guestName: "Other" }))).not.toBe(base);
    expect(stayFingerprint(stay({ totalMinor: 1 }))).not.toBe(base);
    expect(stayFingerprint(stay({ currency: "USD" }))).not.toBe(base);
    expect(stayFingerprint(stay({ status: "modified" }))).not.toBe(base);
    expect(stayFingerprint(stay({ lines: [line({ quantity: 2 })] }))).not.toBe(base);
    expect(stayFingerprint(stay({ lines: [line({ checkIn: "2026-08-21" })] }))).not.toBe(base);
  });

  it("treats an absent price and a null price as the same absence", () => {
    // Legacy imports omit the key; Channex sends null. Both mean "no price", and treating them as
    // different would make every pull of such a booking look like a modification.
    const { priceMinor: _omitted, ...withoutPrice } = line();
    expect(stayFingerprint(stay({ lines: [line({ priceMinor: null })] })))
      .toBe(stayFingerprint(stay({ lines: [withoutPrice] })));
  });

  it("does not let one field's value bleed into the next", () => {
    // A naive join lets "AB" + "C" collide with "A" + "BC". Cheap to get wrong, silent when it is.
    expect(stayFingerprint(stay({ guestName: "A", currency: "BC" })))
      .not.toBe(stayFingerprint(stay({ guestName: "AB", currency: "C" })));
  });
});
