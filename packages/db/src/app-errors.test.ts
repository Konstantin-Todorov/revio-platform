import { describe, it, expect } from "vitest";
import { errorSignature, isDeployMismatch } from "./app-errors.js";

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

/**
 * The filter has to be wrong in neither direction, and the two directions cost different things.
 *
 * Too narrow and the log fills with deploy weather until nobody opens it. Too broad and it eats a
 * real fault — silently, in the one place built to make faults findable. So the false-negative
 * tests below matter more than the false-positive ones, and there are deliberately more of them.
 */
describe("isDeployMismatch", () => {
  it("catches Next's own server-side wording, verbatim from production", () => {
    // This exact string, from four apps, was 80% of the unresolved log when the filter was written.
    expect(
      isDeployMismatch(
        "Failed to find Server Action. This request might be from an older or newer deployment.\n" +
          "Read more: https://nextjs.org/docs/messages/failed-to-find-server-action",
      ),
    ).toBe(true);
  });

  it("catches Next 15's newer browser wording, verbatim from production on 2026-09-25", () => {
    expect(isDeployMismatch('Server Action "003bcae9ace9ab6e2451de49113c112009c1da4c5b" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action')).toBe(true);
  });

  it("catches the browser-side twin, which has the same cause and arrives by another road", () => {
    // A tab open across a deploy asking for a chunk the new build no longer ships. It reaches us
    // through /api/client-error rather than the server hook, and it is the same non-event.
    expect(isDeployMismatch("ChunkLoadError: Loading chunk 4821 failed.")).toBe(true);
    expect(isDeployMismatch("Loading chunk app/layout failed.")).toBe(true);
    expect(isDeployMismatch("Failed to fetch dynamically imported module: https://pms.reviosoft.app/_next/x.js")).toBe(true);
    expect(isDeployMismatch("error loading dynamically imported module")).toBe(true);
  });

  it("does not eat a bare network failure", () => {
    // "Failed to fetch" on its own is a real fault with many causes — an API we call being down,
    // a CORS mistake, a broken URL. Matching the prefix would have hidden every one of them.
    expect(isDeployMismatch("Failed to fetch")).toBe(false);
    expect(isDeployMismatch("TypeError: Failed to fetch")).toBe(false);
  });

  it("does not eat a fault that merely mentions a chunk or a module", () => {
    expect(isDeployMismatch("Cannot read properties of undefined (reading 'chunk')")).toBe(false);
    expect(isDeployMismatch("Module not found: Can't resolve './folio'")).toBe(false);
  });

  it("does not eat anything from our own domain code", () => {
    // The faults the log exists for. Every one of these must still be filed.
    for (const real of [
      "Invalid `prisma.ratePrice.upsert()` invocation",
      "Can't reach database server at `postgres.railway.internal:5432`",
      "Unexpected close",
      "Folio is closed",
      "No availability for the requested stay",
      "Not found",
    ]) {
      expect(isDeployMismatch(real), real).toBe(false);
    }
  });

  it("does not eat an action fault that is about our code rather than the build", () => {
    // Close wording, different condition: this one is a real server action throwing.
    expect(isDeployMismatch("Server Action failed: folio is already closed")).toBe(false);
  });

  it("holds on an empty or junk message", () => {
    expect(isDeployMismatch("")).toBe(false);
    expect(isDeployMismatch("Unknown error")).toBe(false);
  });
});
