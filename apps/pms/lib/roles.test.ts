import { describe, expect, it } from "vitest";
import { CAPABILITY_ROLES, PMS_ROLES, roleAllowsPath, roleHasCapability, roleHome, SCOPED_NAV } from "./roles";

/**
 * The permission matrix is the one piece of this app where a silent mistake is a security bug rather
 * than a visual one, so it is pinned here rather than trusted to review.
 */

const MANAGERS = ["owner", "admin", "manager"];
const SCOPED = ["housekeeper", "hk_supervisor", "maintenance", "outlet_pos"];

describe("capabilities", () => {
  it("gives owner, admin and manager every capability", () => {
    for (const role of MANAGERS) {
      for (const cap of Object.keys(CAPABILITY_ROLES) as (keyof typeof CAPABILITY_ROLES)[]) {
        expect(roleHasCapability(role, cap), `${role} → ${cap}`).toBe(true);
      }
    }
  });

  it("keeps every scoped role away from the money", () => {
    // The whole point of the gate: a housekeeper POSTing a payment must not succeed.
    for (const role of SCOPED) {
      expect(roleHasCapability(role, "frontDesk"), `${role} → frontDesk`).toBe(false);
      expect(roleHasCapability(role, "manage"), `${role} → manage`).toBe(false);
    }
  });

  it("lets each scoped role do exactly its own job", () => {
    expect(roleHasCapability("housekeeper", "housekeeping")).toBe(true);
    expect(roleHasCapability("housekeeper", "maintenance")).toBe(false);
    expect(roleHasCapability("housekeeper", "outlet")).toBe(false);

    expect(roleHasCapability("hk_supervisor", "housekeeping")).toBe(true);
    expect(roleHasCapability("hk_supervisor", "maintenance")).toBe(true);

    expect(roleHasCapability("maintenance", "maintenance")).toBe(true);
    expect(roleHasCapability("maintenance", "housekeeping")).toBe(false);

    expect(roleHasCapability("outlet_pos", "outlet")).toBe(true);
    expect(roleHasCapability("outlet_pos", "housekeeping")).toBe(false);
  });

  it("lets reception run the desk but not the configuration", () => {
    expect(roleHasCapability("reception", "frontDesk")).toBe(true);
    expect(roleHasCapability("reception", "outlet")).toBe(true);
    expect(roleHasCapability("reception", "housekeeping")).toBe(true);
    expect(roleHasCapability("reception", "manage")).toBe(false);
  });

  it("denies an unknown role everything", () => {
    // A role string arriving from another product (or a typo) must fail closed, not open.
    for (const cap of Object.keys(CAPABILITY_ROLES) as (keyof typeof CAPABILITY_ROLES)[]) {
      expect(roleHasCapability("read_only", cap), `read_only → ${cap}`).toBe(false);
      expect(roleHasCapability("", cap)).toBe(false);
    }
  });

  it("covers every declared PMS role", () => {
    // A role added to PMS_ROLES without a capability decision would silently have none.
    for (const role of PMS_ROLES) {
      const caps = Object.keys(CAPABILITY_ROLES).filter((c) => roleHasCapability(role, c as never));
      expect(caps.length, `${role} holds no capability`).toBeGreaterThan(0);
    }
  });
});

describe("screen scoping", () => {
  it("bounces a scoped role off screens it doesn't own", () => {
    expect(roleAllowsPath("housekeeper", "/folios")).toBe(false);
    expect(roleAllowsPath("housekeeper", "/housekeeping")).toBe(true);
    expect(roleAllowsPath("outlet_pos", "/configuration")).toBe(false);
    expect(roleAllowsPath("maintenance", "/users")).toBe(false);
  });

  it("does not let a prefix collision open a screen", () => {
    // "/housekeeping-secrets" must not pass because it starts with "/housekeeping".
    expect(roleAllowsPath("housekeeper", "/housekeeping-secrets")).toBe(false);
    expect(roleAllowsPath("housekeeper", "/housekeeping/analytics")).toBe(true);
  });

  it("sends each scoped role home to a screen it can actually open", () => {
    for (const role of Object.keys(SCOPED_NAV)) {
      expect(roleAllowsPath(role, roleHome(role)), `${role} home`).toBe(true);
    }
  });

  it("leaves full-access roles unrestricted", () => {
    for (const role of [...MANAGERS, "reception"]) {
      expect(roleAllowsPath(role, "/folios")).toBe(true);
      expect(roleAllowsPath(role, "/configuration")).toBe(true);
    }
  });
});
