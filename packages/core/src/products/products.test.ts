import { describe, it, expect } from "vitest";
import {
  PRODUCTS,
  entitledProducts,
  primaryProduct,
  hasOtherProducts,
  unownedProducts,
  type ProductEntitlements,
} from "./products";

const none: ProductEntitlements = { hasChannelManager: false, hasReservation: false, hasPms: false };
const all: ProductEntitlements = { hasChannelManager: true, hasReservation: true, hasPms: true };

describe("entitledProducts — the entitlement is the whole gate", () => {
  it("returns only what the hotel bought", () => {
    expect(entitledProducts({ ...none, hasPms: true }).map((p) => p.key)).toEqual(["pms"]);
    expect(entitledProducts({ ...none, hasChannelManager: true, hasPms: true }).map((p) => p.key))
      .toEqual(["cm", "pms"]);
  });

  it("returns nothing for a tenant with no entitlement", () => {
    expect(entitledProducts(none)).toEqual([]);
  });

  it("keeps the selling order — distribution, record, operations — not alphabetical", () => {
    // A hotel that bought RevioLink thinks of RevioLink as "the system", so it leads.
    expect(entitledProducts(all).map((p) => p.key)).toEqual(["cm", "crs", "pms"]);
  });

  it("never invents a product that does not exist", () => {
    expect(PRODUCTS).toHaveLength(3);
    expect(entitledProducts(all)).toHaveLength(3);
  });
});

describe("primaryProduct — which door an invitation opens", () => {
  it("prefers RevioLink, then RevioCRS, then RevioPMS", () => {
    expect(primaryProduct(all).name).toBe("RevioLink");
    expect(primaryProduct({ ...none, hasReservation: true, hasPms: true }).name).toBe("RevioCRS");
    expect(primaryProduct({ ...none, hasPms: true }).name).toBe("RevioPMS");
  });

  it("still returns something for a tenant entitled to nothing", () => {
    // A provisioning fault to fix, not a null to handle at every call site.
    expect(primaryProduct(none).key).toBe("pms");
  });
});

describe("hasOtherProducts — a switcher with one destination is noise", () => {
  it("is false when the hotel only bought the product they are looking at", () => {
    expect(hasOtherProducts({ ...none, hasReservation: true }, "crs")).toBe(false);
  });

  it("is true as soon as there is somewhere else to go", () => {
    expect(hasOtherProducts({ ...none, hasReservation: true, hasPms: true }, "crs")).toBe(true);
  });

  it("is false for a tenant with nothing", () => {
    expect(hasOtherProducts(none, "crs")).toBe(false);
  });
});

describe("unownedProducts — an argument, not an advert", () => {
  it("offers nothing to a hotel that already has everything", () => {
    expect(unownedProducts(all)).toEqual([]);
  });

  it("offers nothing to a tenant entitled to nothing", () => {
    // They cannot sign in anywhere; a sales pitch is not the fix for a provisioning fault.
    expect(unownedProducts(none)).toEqual([]);
  });

  it("names what they already run, rather than listing features", () => {
    const forLinkOnly = unownedProducts({ ...none, hasChannelManager: true });
    const crs = forLinkOnly.find((p) => p.key === "crs")!;
    // A RevioLink hotel already has channel bookings arriving; that is the case for RevioCRS.
    expect(crs.reason).toContain("already arrive");
  });

  it("changes the wording with what they own", () => {
    const toCrsOnly = unownedProducts({ ...none, hasReservation: true }).find((p) => p.key === "cm")!;
    const toPmsOnly = unownedProducts({ ...none, hasPms: true }).find((p) => p.key === "cm")!;
    expect(toCrsOnly.reason).not.toBe(toPmsOnly.reason);
  });

  it("gives every offered product a reason", () => {
    for (const e of [
      { ...none, hasChannelManager: true },
      { ...none, hasReservation: true },
      { ...none, hasPms: true },
      { ...none, hasChannelManager: true, hasPms: true },
    ]) {
      for (const p of unownedProducts(e)) {
        expect(p.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it("never offers a product the hotel already owns", () => {
    const offered = unownedProducts({ ...none, hasChannelManager: true, hasReservation: true });
    expect(offered.map((p) => p.key)).toEqual(["pms"]);
  });
});
