import { describe, expect, it } from "vitest";
import { emptyFacts, inheritedSteps, welcomeFlow, type ProductName } from "@revio/core";
import { welcomeStepText } from "@revio/ui/welcome-strings";

/**
 * The first-run headings are written twice: in `@revio/core`, which decides which steps a hotel sees,
 * and in `@revio/ui/welcome-strings`, which says them in the reader's language. English must be the
 * same sentence in both, or an English screen changes the day somebody edits one copy.
 *
 * Every step of every product at a large size (so the size-gated step is included), and the
 * "already done" titles from a hotel that runs the other two products with everything set up.
 */
const PRODUCTS: ProductName[] = ["RevioLink", "RevioCRS", "RevioPMS"];

describe("welcome step headings match core, word for word, in English", () => {
  for (const product of PRODUCTS) {
    it(product, () => {
      for (const s of welcomeFlow(product, emptyFacts(60))) {
        const said = welcomeStepText(s.key, product, "en", { title: "", lead: "" });
        expect({ key: s.key, title: said.title, lead: said.lead }).toEqual({ key: s.key, title: s.title, lead: s.lead });
      }
      const done = {
        ...emptyFacts(60),
        hasPropertyDetails: true, hasRoomTypes: true, hasRates: true, hasBrand: true, hasTaxes: true,
        hasInvoiceIdentity: true, hasReservationDelivery: true, hasStaff: true,
        alsoRuns: PRODUCTS.filter((p) => p !== product),
      };
      for (const i of inheritedSteps(product, done)) {
        expect(welcomeStepText(i.key, product, "en", { title: "", lead: "" }).doneTitle).toBe(i.title);
      }
      const shared = welcomeFlow(product, done).find((s) => s.key === "shared");
      if (shared) expect(welcomeStepText("shared", product, "en", shared).lead).toBe(shared.lead);
    });
  }
});
