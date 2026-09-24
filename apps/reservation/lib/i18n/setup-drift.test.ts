import { describe, expect, it } from "vitest";
import { reviocrsSetup } from "@revio/core";
import { dashboard } from "./dashboard";

/**
 * The dashboard checklist is written twice: in `@revio/core`, which decides which steps a hotel sees,
 * and in `./dashboard`, which says them in the reader's language. English must be the same sentence
 * in both, or an English screen changes the day somebody edits one copy.
 */
describe("the RevioCRS dashboard checklist says core's steps word for word, in English", () => {
  it("RevioCRS", () => {
    const facts = { roomTypes: 0, hasRates: false, hasTaxes: false, reservations: 0, alsoRuns: [] } as unknown as Parameters<typeof reviocrsSetup>[0];
    for (const step of reviocrsSetup(facts).steps) {
      const said = dashboard.en.setupSteps[step.key];
      expect({ key: step.key, ...said }).toEqual({ key: step.key, title: step.title, body: step.body, cta: step.cta });
    }
  });
});
