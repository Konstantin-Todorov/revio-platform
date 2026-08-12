import { describe, expect, it } from "vitest";
import {
  SMALL_PROPERTY_MAX_ROOMS,
  isSmallProperty,
  skippedForSize,
  stepIndex,
  totalRooms,
  welcomeFlow,
} from "./welcome.js";
import type { ProductName } from "./setup.js";

const PRODUCTS: ProductName[] = ["RevioLink", "RevioCRS", "RevioPMS"];
const SMALL = 12;
const LARGE = 120;

describe("the size branch", () => {
  it("treats a guesthouse as small and a hotel as large", () => {
    expect(isSmallProperty(SMALL)).toBe(true);
    expect(isSmallProperty(LARGE)).toBe(false);
  });

  it("puts the boundary exactly where the pricing tier does", () => {
    // One number, so the size a hotel is billed against is the size it is onboarded against.
    expect(isSmallProperty(SMALL_PROPERTY_MAX_ROOMS)).toBe(true);
    expect(isSmallProperty(SMALL_PROPERTY_MAX_ROOMS + 1)).toBe(false);
  });

  it("treats an unknown count as small", () => {
    // On the first screens we have not asked yet. Showing a guesthouse the long flow is the worse
    // of the two mistakes.
    expect(isSmallProperty(0)).toBe(true);
  });

  it.each(PRODUCTS)("%s asks a small property strictly fewer questions", (product) => {
    expect(welcomeFlow(product, SMALL).length).toBeLessThan(welcomeFlow(product, LARGE).length);
  });

  it("never asks a 12-room guesthouse about staff — the owner IS the staff", () => {
    for (const product of PRODUCTS) {
      expect(welcomeFlow(product, SMALL).map((s) => s.key)).not.toContain("team");
    }
  });

  it("does ask a 120-room hotel about staff, because somebody there owns the answer", () => {
    expect(welcomeFlow("RevioCRS", LARGE).map((s) => s.key)).toContain("team");
  });

  it("ALWAYS asks about tax on a product that invoices, however small the property", () => {
    // Tax is a money field. A default nobody corrects is money quietly decided by us — and unlike a
    // nightly rate, a wrong VAT is discovered on a document a guest has already been handed.
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      for (const rooms of [1, SMALL, SMALL_PROPERTY_MAX_ROOMS, LARGE]) {
        expect(welcomeFlow(product, rooms).map((s) => s.key)).toContain("taxes");
      }
    }
  });
});

describe("go live", () => {
  it.each(PRODUCTS)("%s always ends on it", (product) => {
    for (const rooms of [SMALL, LARGE]) {
      const steps = welcomeFlow(product, rooms);
      expect(steps[steps.length - 1]!.key).toBe("golive");
    }
  });

  it.each(PRODUCTS)("%s never lets it be skipped", (product) => {
    for (const rooms of [SMALL, LARGE]) {
      const golive = welcomeFlow(product, rooms).find((s) => s.key === "golive")!;
      expect(golive.skippable).toBe(false);
    }
  });

  it("says what actually happens on RevioLink — rooms go on sale", () => {
    const golive = welcomeFlow("RevioLink", SMALL).find((s) => s.key === "golive")!;
    expect(golive.lead).toContain("Nothing has left Revio until you do");
  });

  it("does not promise a channel push on products that have no channels", () => {
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      const golive = welcomeFlow(product, SMALL).find((s) => s.key === "golive")!;
      expect(golive.lead).not.toContain("Connect a channel");
    }
  });
});

describe("per-product shape", () => {
  it("never asks the PMS for a price — it sells nothing", () => {
    for (const rooms of [SMALL, LARGE]) {
      expect(welcomeFlow("RevioPMS", rooms).map((s) => s.key)).not.toContain("prices");
    }
  });

  it("does ask RevioLink and RevioCRS for one", () => {
    for (const product of ["RevioLink", "RevioCRS"] as ProductName[]) {
      expect(welcomeFlow(product, SMALL).map((s) => s.key)).toContain("prices");
    }
  });

  it("never asks RevioLink about taxes — that is not what a channel manager does", () => {
    expect(welcomeFlow("RevioLink", LARGE).map((s) => s.key)).not.toContain("taxes");
  });

  it.each(PRODUCTS)("%s always confirms the property first", (product) => {
    expect(welcomeFlow(product, SMALL)[0]!.key).toBe("property");
  });

  it.each(PRODUCTS)("%s uses each step once", (product) => {
    const keys = welcomeFlow(product, LARGE).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PRODUCTS)("%s gives every screen a heading and a sentence", (product) => {
    for (const s of welcomeFlow(product, LARGE)) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.lead.length).toBeGreaterThan(0);
    }
  });
});

describe("skippedForSize", () => {
  it("names what was decided for a small property, so the last screen can say so", () => {
    // Nothing is skipped silently — a default nobody can see is not a default, it is a surprise.
    expect(skippedForSize("RevioCRS", SMALL)).toEqual(["team"]);
  });

  it("never reports tax as skipped, because it never is", () => {
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      expect(skippedForSize(product, SMALL)).not.toContain("taxes");
    }
  });

  it("is empty for a large property, which was asked everything", () => {
    expect(skippedForSize("RevioCRS", LARGE)).toEqual([]);
  });

  it("reports only steps that product has at all", () => {
    // RevioLink has no taxes step, so it can never be reported as skipped.
    expect(skippedForSize("RevioLink", SMALL)).not.toContain("taxes");
  });
});

describe("the personalisation step", () => {
  it("is offered by the guest-facing products", () => {
    for (const product of ["RevioLink", "RevioCRS"] as ProductName[]) {
      expect(welcomeFlow(product, SMALL).map((s) => s.key)).toContain("brand");
    }
  });

  it("is absent from the PMS, which shows a guest nothing", () => {
    for (const rooms of [SMALL, LARGE]) {
      expect(welcomeFlow("RevioPMS", rooms).map((s) => s.key)).not.toContain("brand");
    }
  });

  it("is skippable — a logo is not a reason to block a hotel from trading", () => {
    const brand = welcomeFlow("RevioCRS", SMALL).find((s) => s.key === "brand")!;
    expect(brand.skippable).toBe(true);
  });

  it("is offered at every size — looking right is not a large-hotel concern", () => {
    for (const rooms of [1, SMALL, LARGE, 500]) {
      expect(welcomeFlow("RevioCRS", rooms).map((s) => s.key)).toContain("brand");
    }
  });

  it("says it covers both surfaces, because one answer feeds both", () => {
    const brand = welcomeFlow("RevioLink", SMALL).find((s) => s.key === "brand")!;
    expect(brand.lead).toContain("email");
    expect(brand.lead).toContain("booking page");
  });
});

describe("stepIndex", () => {
  it("finds a step", () => {
    expect(stepIndex(welcomeFlow("RevioLink", SMALL), "rooms")).toBe(1);
  });

  it("returns -1 for a URL naming a step that does not exist, rather than crashing", () => {
    expect(stepIndex(welcomeFlow("RevioLink", SMALL), "nonsense")).toBe(-1);
  });

  it("returns -1 for a step this size was not asked", () => {
    // "team" is the only size-gated step left; taxes are now asked at every size.
    expect(stepIndex(welcomeFlow("RevioCRS", SMALL), "team")).toBe(-1);
  });
});

describe("totalRooms", () => {
  it("sums the physical rooms across room types", () => {
    expect(totalRooms([{ totalRooms: 10 }, { totalRooms: 14 }])).toBe(24);
  });

  it("is zero before any room type exists", () => {
    expect(totalRooms([])).toBe(0);
  });

  it("survives a room type with no count set", () => {
    expect(totalRooms([{ totalRooms: 0 }, { totalRooms: 5 }])).toBe(5);
  });
});
