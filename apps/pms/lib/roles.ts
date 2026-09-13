// Plain module (no "use server"/"use client") so both server actions and client components can import
// these constants. A "use server" file may only export async functions, so role data can't live there.

// PMS operational roles (spec §3.9) layered on the shared account roles. owner/admin are the
// platform-wide managers; the rest are PMS-operational. The account is one shared identity.
//
// ⚠️ The LIST lives in `@revio/core` (auth/read-scope) and is re-exported here. It used to be typed
// out in this file, and a second copy of a role list is the copy that goes stale — a role missing
// from one of them is precisely the "unknown role" the default-deny below has to refuse.
import { roleCanOpenProduct } from "@revio/core";

export { PMS_ROLES, type PmsRole } from "@revio/core";

export const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);

// ⚠️ Re-exported from `@revio/core`, not restated. This map was the fullest of the three copies
// that existed — the other two knew only the commercial roles — which is precisely why keeping
// three was a bug waiting for the first screen that had to name a role from another product.
export { ROLE_LABEL } from "@revio/core";

// Outlets that sell POS items (spec §3.7). Minibar is one outlet among several.
export const POS_OUTLETS = ["minibar", "spa", "bar", "restaurant"] as const;
export type PosOutlet = (typeof POS_OUTLETS)[number];
export const POS_OUTLET_LABEL: Record<string, string> = { minibar: "Minibar", spa: "Spa", bar: "Bar", restaurant: "Restaurant" };

// Scoped roles see only part of the PMS — the housekeeper mobile view (§3.4) and the outlet-only
// posting view (§3.7). Any role not listed here has full access. Drives BOTH the sidebar filter and
// the layout route-guard, so typing a URL can't escape the scope.
/*
 * ⚠️ `/help` is in EVERY list, deliberately.
 *
 * `actions-support.ts` states the principle and is exempted from the capability lint for it:
 * *"anybody signed in may ask for help, whatever their role — a housekeeper who cannot open
 * Settings is exactly the person most likely to be standing in front of a broken screen, and a
 * support form that refuses them loses the report."*
 *
 * The nav contradicted that. A housekeeper saw one item and had no route to Help at all, so the
 * person most likely to need it was the one person who could not reach it. Found on 2026-09-11
 * while making the bottom of the menu consistent across the three products.
 */
const HELP = "/help";

export const SCOPED_NAV: Record<string, string[]> = {
  housekeeper: ["/housekeeping", HELP],
  hk_supervisor: ["/housekeeping", "/rooms", "/maintenance", HELP],
  maintenance: ["/maintenance", "/rooms", HELP],
  outlet_pos: ["/minibar", HELP],
};
export function roleHome(role: string): string {
  return SCOPED_NAV[role]?.[0] ?? "/dashboard";
}
/**
 * May this role SEE this screen?
 *
 * ⚠️ **Default deny.** This used to end `if (!allowed) return true; // full-access role`, which read
 * as "a role with no scope is a manager" and meant something quite different: any role RevioPMS had
 * never heard of got everything. A `revenue_manager` — hired to price rooms, and a perfectly valid
 * account on the same shared identity — opened the front desk, folios, guest identity documents and
 * Close Day. The fix is to ask first whether the role belongs in this product at all
 * (`roleCanOpenProduct`, tested in core), and only then which of its screens it may see.
 */
export function roleAllowsPath(role: string, pathname: string): boolean {
  if (!roleCanOpenProduct(role, "pms")) return false;
  const allowed = SCOPED_NAV[role];
  if (!allowed) return true; // a full-access PMS role: owner, admin, manager
  return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// --- Capabilities -----------------------------------------------------------
// WHO may perform a write, as opposed to SCOPED_NAV above which decides who may SEE a screen. The
// two are separate because hiding a screen does not protect the action behind it: a server action is
// a POST that Next runs before the layout re-renders and re-guards. Pure data, so it is unit-tested.

const MANAGERS = ["owner", "admin", "manager"] as const;

/**
 * Who may clock somebody ELSE in or out.
 *
 * Reception as well as managers, deliberately: the front desk is who notices that the cleaner on the
 * second floor never clocked in. Wider than `manage` and narrower than `housekeeping` — a housekeeper
 * may start their own shift and nobody else's.
 *
 * Lives here rather than in the action file because this is the policy module: it is pure, it is
 * unit-tested, and a screen has to ask the same question the action will answer.
 */
export const DELEGATOR_ROLES: ReadonlySet<string> = new Set([...MANAGERS, "hk_supervisor", "reception"]);

export const CAPABILITY_ROLES = {
  /** Configuration, staff, deposit types, invoicing, close day, room inventory. */
  manage: [...MANAGERS],
  /** Check-in/out, room moves, walk-ins, folios, payments. */
  frontDesk: [...MANAGERS, "reception"],
  /** Room status, cleaning start/finish, reporting an issue. */
  housekeeping: [...MANAGERS, "reception", "hk_supervisor", "housekeeper"],
  /** Raising and working maintenance tasks. */
  maintenance: [...MANAGERS, "hk_supervisor", "maintenance"],
  /** Posting outlet items to a folio. */
  outlet: [...MANAGERS, "reception", "outlet_pos"],
  /**
   * What the account BUYS: starting a free trial of another product, asking to keep one.
   *
   * ⚠️ Narrower than `manage`, and that is the whole reason it is its own entry. A `manager` runs
   * this hotel's operation — configuration, staff, close day — and cannot sign the company up for
   * anything. Every other capability here names data at risk; this one names money.
   *
   * Matches `manageSubscription` in `@revio/core`, which is the authoritative rule (`selfStartTrial`
   * checks it again on the other side of the perimeter). This is the local half so the refusal is a
   * sentence on the screen rather than a silent no.
   */
  subscription: ["owner", "admin"],
} satisfies Record<string, readonly string[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

export function roleHasCapability(role: string, cap: Capability): boolean {
  return (CAPABILITY_ROLES[cap] as readonly string[]).includes(role);
}
