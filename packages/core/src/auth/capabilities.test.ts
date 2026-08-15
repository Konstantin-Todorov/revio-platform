import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_ROLES,
  capabilitiesOf,
  isReadOnly,
  refusalMessage,
  roleCan,
  type Capability,
} from "./capabilities";

const ALL_CAPS: Capability[] = [
  "manageStaff",
  "manageSettings",
  "manageRates",
  "manageInventory",
  "manageDistribution",
  "manageReservations",
];

describe("commercial capabilities", () => {
  it("gives owner and admin everything", () => {
    for (const cap of ALL_CAPS) {
      expect(roleCan("owner", cap), `owner → ${cap}`).toBe(true);
      expect(roleCan("admin", cap), `admin → ${cap}`).toBe(true);
    }
  });

  it("gives read_only nothing at all", () => {
    for (const cap of ALL_CAPS) {
      expect(roleCan("read_only", cap), `read_only → ${cap}`).toBe(false);
    }
    expect(isReadOnly("read_only")).toBe(true);
  });

  /*
   * The split that justifies having two manager roles instead of one. If this test ever goes green
   * both ways, the roles have collapsed into each other and the product has two names for one thing.
   */
  it("keeps pricing and distribution in different hands", () => {
    expect(roleCan("revenue_manager", "manageRates")).toBe(true);
    expect(roleCan("revenue_manager", "manageDistribution")).toBe(false);

    expect(roleCan("distribution_manager", "manageDistribution")).toBe(true);
    expect(roleCan("distribution_manager", "manageRates")).toBe(false);
  });

  it("lets only owner and admin touch staff or settings", () => {
    for (const role of COMMERCIAL_ROLES) {
      const privileged = role === "owner" || role === "admin";
      expect(roleCan(role, "manageStaff"), `${role} → manageStaff`).toBe(privileged);
      expect(roleCan(role, "manageSettings"), `${role} → manageSettings`).toBe(privileged);
    }
  });

  /*
   * Default deny, tested with the roles that actually exist rather than with a made-up string.
   *
   * These are PMS operational roles. They live on the SAME shared identity, so a housekeeper can
   * sign in to RevioCRS with the account they use for the PMS. They must be able to write nothing
   * there — and the reason this is a real test rather than a theoretical one is that the roles
   * already exist in the same database column.
   */
  it.each(["housekeeper", "hk_supervisor", "maintenance", "outlet_pos", "reception", "manager"])(
    "denies the PMS role %s every commercial capability",
    (role) => {
      for (const cap of ALL_CAPS) {
        expect(roleCan(role, cap), `${role} → ${cap}`).toBe(false);
      }
    },
  );

  it.each(["", "OWNER", "Admin", "superuser", "undefined", "null"])(
    "denies the unrecognised role %p everything",
    (role) => {
      for (const cap of ALL_CAPS) expect(roleCan(role, cap)).toBe(false);
      expect(capabilitiesOf(role)).toEqual([]);
    },
  );

  it("never reports a role as read-only when it can in fact write", () => {
    for (const role of COMMERCIAL_ROLES) {
      const canSomething = ALL_CAPS.some((c) => roleCan(role, c));
      expect(isReadOnly(role), `${role}`).toBe(!canSomething);
    }
  });

  describe("refusal message", () => {
    it("tells a read-only user why, and who can change it", () => {
      const msg = refusalMessage("read_only", "manageRates");
      expect(msg).toContain("read-only");
      expect(msg).toContain("owner or admin");
      // The point of the message is the next step, not the permission name.
      expect(msg).not.toContain("manageRates");
    });

    it("does not call a partially-privileged role read-only", () => {
      const msg = refusalMessage("revenue_manager", "manageDistribution");
      expect(msg).not.toContain("read-only");
      expect(msg).toContain("channel connections");
    });
  });
});
