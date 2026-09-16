import { describe, expect, it } from "vitest";

import { emptyFacts, welcomeFlow, type WelcomeFacts, type WelcomeStepKey } from "./welcome";
import type { ProductName } from "./setup.js";

/**
 * The founder's question, asked directly of the code:
 *
 * > "if someone gets the PMS and after two weeks decides to try the CM will they have an onboarding
 * > on the CM or on the CRS … or will they have empty fields that can lead to unexpected errors"
 *
 * `welcome.test.ts` covers the rules one at a time. This walks all **six** orders a hotel can adopt
 * the three products in, end to end, and asserts the two things that actually decide whether a
 * second product is safe to open:
 *
 * 1. Nothing a product needs is left unset once its flow is done.
 * 2. No step is skipped unless the data genuinely exists — in particular `units`, which no other
 *    product can supply, is asked exactly once no matter what came before it.
 *
 * ⚠️ These flows are what a **founder** reads to decide whether to sell the second product, so the
 * failure message prints the whole walk rather than one boolean.
 */

/** The facts each step is responsible for filling in. */
const STEP_WRITES: Record<WelcomeStepKey, (keyof FactFlags)[]> = {
  property: ["hasPropertyDetails"],
  rooms: ["hasRoomTypes"],
  units: ["hasUnits"],
  prices: ["hasRates"],
  brand: ["hasBrand"],
  taxes: ["hasTaxes", "hasInvoiceIdentity"],
  delivery: ["hasReservationDelivery"],
  team: ["hasStaff"],
  // Neither asks for anything: `shared` lists what carried over, `golive` is the closing screen.
  shared: [],
  golive: [],
};

type FactFlags = Omit<WelcomeFacts, "rooms" | "alsoRuns">;

const ALL: ProductName[] = ["RevioLink", "RevioCRS", "RevioPMS"];

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x) => permutations(xs.filter((y) => y !== x)).map((rest) => [x, ...rest]));
}

/** Open `product` for a hotel in this state, and return the state after its flow is completed. */
function complete(product: ProductName, state: WelcomeFacts) {
  const facts: WelcomeFacts = { ...state, alsoRuns: ALL.filter((p) => p !== product) };
  const steps = welcomeFlow(product, facts);
  const next = { ...state };
  for (const step of steps) {
    for (const fact of STEP_WRITES[step.key]) next[fact] = true;
  }
  return { steps: steps.map((s) => s.key), next };
}

/** 24 rooms is below `SMALL_PROPERTY_MAX_ROOMS`; 40 is above it. Staff is the one size-gated step. */
const SMALL = 24;
const LARGE = 40;

function walk(order: ProductName[], rooms = SMALL) {
  let state: WelcomeFacts = { ...emptyFacts(rooms), alsoRuns: [] };
  const legs = order.map((product) => {
    const { steps, next } = complete(product, state);
    state = next;
    return { product, steps };
  });
  return { legs, state };
}

function render(order: ProductName[], legs: { product: ProductName; steps: WelcomeStepKey[] }[]) {
  return [
    order.join(" → "),
    ...legs.map((l, i) => `  ${i + 1}. ${l.product.padEnd(10)} ${l.steps.length} screen(s): ${l.steps.join(", ")}`),
  ].join("\n");
}

describe("adopting the products in any order", () => {
  const orders = permutations(ALL);

  it("covers every step a product can ask for, so a new step cannot slip past this file", () => {
    const seen = new Set<WelcomeStepKey>();
    for (const order of orders) for (const leg of walk(order).legs) for (const k of leg.steps) seen.add(k);
    // Every key the flows can produce must have an entry above. A step added without one would
    // silently write nothing here and this whole file would quietly stop testing it.
    for (const key of seen) expect(STEP_WRITES, `step "${key}" has no STEP_WRITES entry`).toHaveProperty(key);
  });

  it.each(orders.map((o) => [o.join(" → "), o] as const))(
    "%s leaves nothing unset at a large property",
    (_name, order) => {
      const { legs, state } = walk(order, LARGE);
      const unset = (Object.keys(STEP_WRITES) as WelcomeStepKey[])
        .flatMap((k) => STEP_WRITES[k])
        .filter((f) => state[f] === false);
      expect(unset, `${render(order, legs)}\n  UNSET: ${unset.join(", ")}`).toEqual([]);
    },
  );

  it.each(orders.map((o) => [o.join(" → "), o] as const))(
    "%s leaves only staff unset at a small property, and asks it once when large",
    (_name, order) => {
      // `staff` is the ONLY size-gated step: a 24-room hotel is run by the people who signed up, so
      // asking them to invite colleagues on day one is a screen with nothing to type into it. This
      // pins that it is the only thing size can leave unset — if a second step ever becomes
      // size-gated, this fails and somebody has to decide that on purpose.
      const small = walk(order, SMALL);
      const unset = (Object.keys(STEP_WRITES) as WelcomeStepKey[])
        .flatMap((k) => STEP_WRITES[k])
        .filter((f) => small.state[f] === false);
      expect(unset, `${render(order, small.legs)}\n  UNSET: ${unset.join(", ")}`).toEqual(["hasStaff"]);
      expect(small.legs.flatMap((l) => l.steps)).not.toContain("team");

      const large = walk(order, LARGE);
      expect(large.legs.flatMap((l) => l.steps).filter((k) => k === "team")).toEqual(["team"]);
    },
  );

  it.each(orders.map((o) => [o.join(" → "), o] as const))(
    "%s asks for PMS units exactly once",
    (_name, order) => {
      const { legs } = walk(order);
      // `units` is the one step no other product can supply — a room type is a thing you sell, a
      // unit is a door. Reception cannot check anyone in until the doors exist, so it must be asked
      // whenever PMS is opened and must never be inherited from anything.
      const asked = legs.filter((l) => l.steps.includes("units"));
      expect(asked.map((l) => l.product), render(order, legs)).toEqual(["RevioPMS"]);
    },
  );

  it.each(orders.map((o) => [o.join(" → "), o] as const))(
    "%s never opens a product on a flow with no screens",
    (_name, order) => {
      const { legs } = walk(order);
      // A second product that opens straight onto the dashboard with no word about what carried
      // over reads as "nothing happened" — which is exactly the moment a hotel decides the upsell
      // was empty. The `shared` screen is what stops that, so every leg has at least it and golive.
      for (const leg of legs) {
        expect(leg.steps.length, render(order, legs)).toBeGreaterThanOrEqual(2);
        expect(leg.steps.at(-1), render(order, legs)).toBe("golive");
      }
    },
  );

  it("never asks a later product for something an earlier one already supplied", () => {
    // NOT "the second product asks fewer screens" — that is false and it was worth finding out.
    // PMS first then RevioLink is 5 screens either side: PMS asks property/rooms/units/taxes,
    // RevioLink then asks prices/brand/delivery, which PMS genuinely never collected. The real
    // promise is narrower and actually holds: nothing is ever asked twice.
    for (const order of orders) {
      const { legs } = walk(order, LARGE);
      expect(legs[0]!.steps, render(order, legs)).not.toContain("shared");

      const askedBefore = new Set<WelcomeStepKey>();
      for (const leg of legs) {
        for (const key of leg.steps) {
          if (key === "shared" || key === "golive") continue;
          expect(askedBefore.has(key), `${render(order, legs)}\n  "${key}" asked twice`).toBe(false);
          askedBefore.add(key);
        }
      }
      for (const later of legs.slice(1)) {
        expect(later.steps, render(order, legs)).toContain("shared");
      }
    }
  });
});
