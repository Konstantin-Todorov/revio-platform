import { describe, expect, it } from "vitest";
import {
  SMALL_PROPERTY_MAX_ROOMS,
  emptyFacts,
  inheritedSteps,
  isSmallProperty,
  nextStep,
  previousStep,
  skippedForSize,
  stepIndex,
  totalRooms,
  welcomeFlow,
  type WelcomeFacts,
} from "./welcome.js";
import type { ProductName } from "./setup.js";

const PRODUCTS: ProductName[] = ["RevioLink", "RevioCRS", "RevioPMS"];
const SMALL = 12;
const LARGE = 120;

/** A hotel onboarding its first product, with nothing configured yet. */
const fresh = (rooms: number): WelcomeFacts => emptyFacts(rooms);

/** A hotel that has fully configured the shared core through the products in `alsoRuns`. */
const established = (rooms: number, alsoRuns: ProductName[]): WelcomeFacts => ({
  rooms,
  hasPropertyDetails: true,
  hasRoomTypes: true,
  hasUnits: true,
  hasRates: true,
  hasBrand: true,
  hasTaxes: true,
  hasInvoiceIdentity: true,
  hasReservationDelivery: true,
  hasStaff: true,
  alsoRuns,
});

const keys = (product: ProductName, facts: WelcomeFacts) => welcomeFlow(product, facts).map((s) => s.key);

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
    expect(welcomeFlow(product, fresh(SMALL)).length).toBeLessThan(welcomeFlow(product, fresh(LARGE)).length);
  });

  it("never asks a 12-room guesthouse about staff — the owner IS the staff", () => {
    for (const product of PRODUCTS) {
      expect(keys(product, fresh(SMALL))).not.toContain("team");
    }
  });

  it("does ask a 120-room hotel about staff, because somebody there owns the answer", () => {
    expect(keys("RevioCRS", fresh(LARGE))).toContain("team");
  });

  it("ALWAYS asks about tax and invoicing on a product that invoices, however small", () => {
    // Money and legal fields are never defaulted. A guesthouse still owes VAT, and unlike a nightly
    // rate a wrong one is discovered on a document a guest has already been handed.
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      for (const rooms of [1, SMALL, SMALL_PROPERTY_MAX_ROOMS, LARGE]) {
        expect(keys(product, fresh(rooms))).toContain("taxes");
      }
    }
  });

  it("always asks for the property's own address and contact details", () => {
    // They print on every confirmation a guest receives — not a large-hotel concern.
    for (const product of PRODUCTS) {
      for (const rooms of [1, SMALL, LARGE]) {
        expect(keys(product, fresh(rooms))).toContain("property");
      }
    }
  });
});

describe("a second product inherits the shared core", () => {
  it("skips everything RevioLink already answered and opens by saying so", () => {
    const flow = keys("RevioCRS", established(LARGE, ["RevioLink"]));
    expect(flow[0]).toBe("shared");
    expect(flow).not.toContain("property");
    expect(flow).not.toContain("rooms");
    expect(flow).not.toContain("prices");
    expect(flow).not.toContain("brand");
  });

  it("still asks the one thing RevioLink cannot supply — tax and invoicing", () => {
    // A channel manager never invoices, so this genuinely has not been answered before.
    const facts = { ...established(LARGE, ["RevioLink"]), hasTaxes: false, hasInvoiceIdentity: false };
    expect(keys("RevioCRS", facts)).toContain("taxes");
  });

  it("turns a six-screen setup into three", () => {
    const first = welcomeFlow("RevioCRS", fresh(LARGE)).length;
    const second = welcomeFlow("RevioCRS", {
      ...established(LARGE, ["RevioLink"]),
      hasTaxes: false,
      hasInvoiceIdentity: false,
    }).length;
    expect(second).toBeLessThan(first);
    expect(second).toBe(3); // shared → taxes → go live
  });

  it("leaves a third product with only the one question nothing else can answer", () => {
    // Adding the PMS to a hotel already running RevioLink + RevioCRS: property, rooms, tax and staff
    // all carry over. What is left is the doors, which no other product has.
    const facts = { ...established(LARGE, ["RevioLink", "RevioCRS"]), hasUnits: false };
    expect(keys("RevioPMS", facts)).toEqual(["shared", "units", "golive"]);
    expect(welcomeFlow("RevioPMS", facts).length).toBeLessThan(welcomeFlow("RevioPMS", fresh(LARGE)).length);
  });

  it("names which products each inherited step came from, so the hotel can check", () => {
    const inherited = inheritedSteps("RevioPMS", established(LARGE, ["RevioLink", "RevioCRS"]));
    const rooms = inherited.find((s) => s.key === "rooms")!;
    expect(rooms.sharedWith).toEqual(["RevioLink", "RevioCRS"]);
  });

  it("never claims tax was shared with RevioLink — a channel manager has none", () => {
    const inherited = inheritedSteps("RevioCRS", established(LARGE, ["RevioLink"]));
    expect(inherited.map((s) => s.key)).not.toContain("taxes");
  });

  it("shows no opening screen on a first onboarding — there is nothing to inherit", () => {
    for (const product of PRODUCTS) {
      expect(keys(product, fresh(LARGE))).not.toContain("shared");
    }
  });

  it("asks a satisfied step anyway when no other product shares it", () => {
    // The value may be a provisioning default nobody has read. Skipping on existence alone would
    // silently accept it; the screen simply arrives pre-filled instead.
    const alone: WelcomeFacts = { ...established(LARGE, []), alsoRuns: [] };
    expect(keys("RevioCRS", alone)).toContain("property");
    expect(keys("RevioCRS", alone)).toContain("rooms");
  });

  it("still asks the PMS for its physical rooms however many products they run", () => {
    // A room type is a thing you sell; a unit is a door. No other product has doors.
    const facts = { ...established(LARGE, ["RevioLink", "RevioCRS"]), hasUnits: false };
    expect(keys("RevioPMS", facts)).toContain("units");
  });
});

describe("where channel bookings go", () => {
  it("is asked of a hotel running RevioLink on its own", () => {
    expect(keys("RevioLink", fresh(SMALL))).toContain("delivery");
  });

  it("is not asked once a CRS or PMS exists to catch the booking", () => {
    for (const sibling of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      const facts: WelcomeFacts = { ...fresh(SMALL), alsoRuns: [sibling] };
      expect(keys("RevioLink", facts)).not.toContain("delivery");
    }
  });

  it("belongs to RevioLink alone — nothing else receives bookings from outside", () => {
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      expect(keys(product, fresh(LARGE))).not.toContain("delivery");
    }
  });
});

describe("go live", () => {
  it.each(PRODUCTS)("%s always ends on it", (product) => {
    for (const facts of [fresh(SMALL), fresh(LARGE), established(LARGE, ["RevioLink"])]) {
      const steps = welcomeFlow(product, facts);
      expect(steps[steps.length - 1]!.key).toBe("golive");
    }
  });

  it.each(PRODUCTS)("%s never lets it be skipped", (product) => {
    for (const rooms of [SMALL, LARGE]) {
      const golive = welcomeFlow(product, fresh(rooms)).find((s) => s.key === "golive")!;
      expect(golive.skippable).toBe(false);
    }
  });

  it("says what actually happens on RevioLink — rooms go on sale", () => {
    const golive = welcomeFlow("RevioLink", fresh(SMALL)).find((s) => s.key === "golive")!;
    expect(golive.lead).toContain("Nothing has left Revio until you do");
  });

  it("does not promise a channel push on products that have no channels", () => {
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      const golive = welcomeFlow(product, fresh(SMALL)).find((s) => s.key === "golive")!;
      expect(golive.lead).not.toContain("Connect a channel");
    }
  });
});

describe("per-product shape", () => {
  it("never asks the PMS for a price — it sells nothing", () => {
    for (const rooms of [SMALL, LARGE]) {
      expect(keys("RevioPMS", fresh(rooms))).not.toContain("prices");
    }
  });

  it("never asks the PMS how it looks to guests — it shows a guest nothing", () => {
    for (const rooms of [SMALL, LARGE]) {
      expect(keys("RevioPMS", fresh(rooms))).not.toContain("brand");
    }
  });

  it("does ask RevioLink and RevioCRS for a price", () => {
    for (const product of ["RevioLink", "RevioCRS"] as ProductName[]) {
      expect(keys(product, fresh(SMALL))).toContain("prices");
    }
  });

  it("never asks RevioLink about taxes — that is not what a channel manager does", () => {
    expect(keys("RevioLink", fresh(LARGE))).not.toContain("taxes");
  });

  it("only the PMS asks for physical rooms", () => {
    for (const product of ["RevioLink", "RevioCRS"] as ProductName[]) {
      expect(keys(product, fresh(LARGE))).not.toContain("units");
    }
    expect(keys("RevioPMS", fresh(LARGE))).toContain("units");
  });

  it.each(PRODUCTS)("%s always confirms the property first on a first onboarding", (product) => {
    expect(keys(product, fresh(SMALL))[0]).toBe("property");
  });

  it.each(PRODUCTS)("%s uses each step once", (product) => {
    const k = keys(product, fresh(LARGE));
    expect(new Set(k).size).toBe(k.length);
  });

  it.each(PRODUCTS)("%s gives every screen a heading and a sentence", (product) => {
    for (const facts of [fresh(LARGE), established(LARGE, ["RevioLink"])]) {
      for (const s of welcomeFlow(product, facts)) {
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.lead.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("skippedForSize", () => {
  it("names what was decided for a small property, so the last screen can say so", () => {
    // Nothing is skipped silently — a default nobody can see is not a default, it is a surprise.
    expect(skippedForSize("RevioCRS", fresh(SMALL))).toEqual(["team"]);
  });

  it("never reports tax as skipped, because it never is", () => {
    for (const product of ["RevioCRS", "RevioPMS"] as ProductName[]) {
      expect(skippedForSize(product, fresh(SMALL))).not.toContain("taxes");
    }
  });

  it("is empty for a large property, which was asked everything", () => {
    expect(skippedForSize("RevioCRS", fresh(LARGE))).toEqual([]);
  });

  it("does not report a step that was inherited rather than skipped", () => {
    // Staff invited in RevioLink are the same people in RevioCRS. Calling that "skipped for size"
    // would tell a hotel it is missing something it already has.
    expect(skippedForSize("RevioCRS", established(SMALL, ["RevioLink"]))).toEqual([]);
  });
});

describe("the personalisation step", () => {
  it("is offered by the guest-facing products", () => {
    for (const product of ["RevioLink", "RevioCRS"] as ProductName[]) {
      expect(keys(product, fresh(SMALL))).toContain("brand");
    }
  });

  it("is skippable — a logo is not a reason to block a hotel from trading", () => {
    const brand = welcomeFlow("RevioCRS", fresh(SMALL)).find((s) => s.key === "brand")!;
    expect(brand.skippable).toBe(true);
  });

  it("is offered at every size — looking right is not a large-hotel concern", () => {
    for (const rooms of [1, SMALL, LARGE, 500]) {
      expect(keys("RevioCRS", fresh(rooms))).toContain("brand");
    }
  });

  it("says it covers both surfaces, because one answer feeds both", () => {
    const brand = welcomeFlow("RevioLink", fresh(SMALL)).find((s) => s.key === "brand")!;
    expect(brand.lead).toContain("email");
    expect(brand.lead).toContain("booking page");
  });
});

describe("moving through the flow", () => {
  it("finds a step", () => {
    expect(stepIndex(welcomeFlow("RevioLink", fresh(SMALL)), "rooms")).toBe(1);
  });

  it("returns -1 for a URL naming a step that does not exist, rather than crashing", () => {
    expect(stepIndex(welcomeFlow("RevioLink", fresh(SMALL)), "nonsense")).toBe(-1);
  });

  it("returns -1 for a step this size was not asked", () => {
    expect(stepIndex(welcomeFlow("RevioCRS", fresh(SMALL)), "team")).toBe(-1);
  });

  it("offers a way back from every screen except the first", () => {
    // Somebody will mistype a room count. Without a back button the only fix is to abandon setup.
    for (const product of PRODUCTS) {
      const steps = welcomeFlow(product, fresh(LARGE));
      expect(previousStep(steps, steps[0]!.key)).toBeNull();
      for (const s of steps.slice(1)) {
        expect(previousStep(steps, s.key)).not.toBeNull();
      }
    }
  });

  it("walks back exactly the way it walked forward", () => {
    const steps = welcomeFlow("RevioCRS", fresh(LARGE));
    for (let i = 1; i < steps.length; i++) {
      expect(previousStep(steps, steps[i]!.key)!.key).toBe(steps[i - 1]!.key);
      expect(nextStep(steps, steps[i - 1]!.key)!.key).toBe(steps[i]!.key);
    }
  });

  it("has no next step after go live", () => {
    const steps = welcomeFlow("RevioLink", fresh(SMALL));
    expect(nextStep(steps, "golive")).toBeNull();
  });

  it("returns null rather than throwing for a step that is not in the flow", () => {
    expect(previousStep(welcomeFlow("RevioLink", fresh(SMALL)), "nonsense")).toBeNull();
    expect(nextStep(welcomeFlow("RevioLink", fresh(SMALL)), "nonsense")).toBeNull();
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

describe("the inherited summary's wording", () => {
  it("names a done step with a noun, not the question the screen asked", () => {
    // "What do you sell? · Already set up" is a question answered with a non-answer. Only visible by
    // looking at the rendered screen — every test passed while it read wrong.
    const titles = inheritedSteps("RevioCRS", established(LARGE, ["RevioLink"])).map((s) => s.title);
    expect(titles).toContain("Your room types");
    expect(titles).not.toContain("What do you sell?");
  });

  it("gives every step a noun form, so none can fall back to a question", () => {
    for (const product of PRODUCTS) {
      for (const s of inheritedSteps(product, established(LARGE, ["RevioLink", "RevioCRS", "RevioPMS"]))) {
        expect(s.title).not.toContain("?");
        expect(s.title.startsWith("Your")).toBe(true);
      }
    }
  });
});
