import { describe, it, expect } from "vitest";
import { errorSignature } from "./app-errors.js";

/**
 * The signature decides what counts as "the same bug", and it has to be wrong in neither direction.
 *
 * Too loose and two unrelated faults sharing a generic message merge, so one of them is invisible.
 * Too tight and the same bug re-keys on every deploy, so the list is a stream of new-looking
 * problems and the count never means anything.
 */

const frame = (file: string, line = 42, col = 7) =>
  `Error: boom\n    at handler (/app/${file}:${line}:${col})\n    at next (/app/node_modules/x.js:1:1)`;

describe("errorSignature", () => {
  it("collapses repeats of the same fault", () => {
    expect(errorSignature("boom", frame("folio.ts"))).toBe(errorSignature("boom", frame("folio.ts")));
  });

  it("survives a deploy that moves the line number", () => {
    // Someone adds a comment ten lines above the bug. It is the same bug; a new row would reset the
    // count and make a long-standing fault look like it appeared today.
    expect(errorSignature("boom", frame("folio.ts", 42))).toBe(errorSignature("boom", frame("folio.ts", 91, 3)));
  });

  it("separates the same message thrown from different places", () => {
    // "Not found" from the folio and "Not found" from the invoice issuer are two different bugs.
    expect(errorSignature("Not found", frame("folio.ts"))).not.toBe(errorSignature("Not found", frame("invoice.ts")));
  });

  it("separates different messages from the same place", () => {
    expect(errorSignature("boom", frame("folio.ts"))).not.toBe(errorSignature("bang", frame("folio.ts")));
  });

  it("handles an error with no stack at all", () => {
    // A thrown string, or an error crossing a boundary that dropped the stack. It must still key.
    expect(errorSignature("boom", undefined)).toBe(errorSignature("boom", undefined));
    expect(errorSignature("boom", undefined)).not.toBe(errorSignature("other", undefined));
  });

  it("ignores a cache-busting query string in the frame", () => {
    // Next appends build-id-ish suffixes to chunk paths; without stripping them every deploy would
    // look like a brand-new fault.
    const a = "Error: boom\n    at h (/app/.next/chunks/page.js?abc123:1:1)";
    const b = "Error: boom\n    at h (/app/.next/chunks/page.js?def456:1:1)";
    expect(errorSignature("boom", a)).toBe(errorSignature("boom", b));
  });

  it("is bounded, so a huge message cannot overflow the index", () => {
    const s = errorSignature("x".repeat(5000), frame("folio.ts"));
    expect(s.length).toBeLessThan(400);
  });

  it("cannot collide, because it is the identity rather than a digest of it", () => {
    // The whole reason it is not hashed: two distinct faults merging would hide one of them, and a
    // composite key makes that impossible instead of merely unlikely.
    expect(errorSignature("a@b", frame("x.ts"))).not.toBe(errorSignature("a", frame("b@x.ts")));
  });

  it("stays readable in the database", () => {
    // When two faults merge that should not have, the reason has to be inspectable.
    expect(errorSignature("Folio is closed", frame("folio.ts"))).toContain("Folio is closed");
  });

  it("gives 500 distinct faults 500 distinct signatures", () => {
    const seen = new Set(Array.from({ length: 500 }, (_, i) => errorSignature(`fault ${i}`, frame("a.ts"))));
    expect(seen.size).toBe(500);
  });
});
