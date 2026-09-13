import { describe, it, expect } from "vitest";
import { COMMERCIAL_ROLES } from "./capabilities.js";
import {
  OPERATIONAL_ROLES, PMS_ROLES, productsForRole, roleCanOpenProduct,
} from "./read-scope.js";

describe("roleCanOpenProduct", () => {
  it("⚠️ a RevioPMS-only role cannot open RevioLink or RevioCRS", () => {
    /*
     * The hole this module exists for. One shared identity means a housekeeper's account signs in to
     * RevioCRS successfully; before this, nothing there filtered a single screen by role, so she
     * could read every guest and every rate in the hotel. Deleting the check makes this go red.
     */
    for (const role of OPERATIONAL_ROLES) {
      expect(roleCanOpenProduct(role, "crs")).toBe(false);
      expect(roleCanOpenProduct(role, "cm")).toBe(false);
      expect(roleCanOpenProduct(role, "pms")).toBe(true);
    }
  });

  it("⚠️ a commercial role cannot open RevioPMS", () => {
    // The same fault in the other direction, and the easier one to miss: `roleAllowsPath` treated a
    // role it did not recognise as a manager, so somebody hired to price rooms got folios, guest
    // identity documents and Close Day.
    for (const role of ["revenue_manager", "distribution_manager", "read_only"]) {
      expect(roleCanOpenProduct(role, "pms")).toBe(false);
      expect(roleCanOpenProduct(role, "crs")).toBe(true);
    }
  });

  it("owner and admin run the hotel, so they open everything", () => {
    for (const role of ["owner", "admin"]) {
      expect(productsForRole(role)).toEqual(["cm", "crs", "pms"]);
    }
  });

  it("⚠️ default-denies a role nobody has mapped", () => {
    // Not a hypothetical: this is what `roleAllowsPath` got wrong by returning true. A role added
    // next year and forgotten must get nothing, never everything.
    for (const role of ["night_auditor", "", "SUPER_ADMIN", "owner ", "Owner"]) {
      expect(productsForRole(role)).toEqual([]);
    }
  });

  it("keeps `read_only` out of RevioPMS while leaving it the commercial products", () => {
    // Deliberate: a read-only auditor belongs in the books, not in a guest's passport scan.
    expect(roleCanOpenProduct("read_only", "crs")).toBe(true);
    expect(roleCanOpenProduct("read_only", "pms")).toBe(false);
  });

  it("every role either product knows resolves to at least one product", () => {
    // Guards the lists themselves: a role in COMMERCIAL_ROLES or PMS_ROLES that maps nowhere is a
    // typo that would lock a real person out, and it would otherwise be found by a customer.
    for (const role of [...COMMERCIAL_ROLES, ...PMS_ROLES]) {
      expect(productsForRole(role).length).toBeGreaterThan(0);
    }
  });
});
