// Plain module (no "use server"/"use client") so both server actions and client components can import
// these constants. A "use server" file may only export async functions, so role data can't live there.

// PMS operational roles (spec §3.9) layered on the shared account roles. owner/admin are the
// platform-wide managers; the rest are PMS-operational. The account is one shared identity.
export const PMS_ROLES = ["owner", "admin", "manager", "reception", "housekeeper", "hk_supervisor", "maintenance", "outlet_pos"] as const;
export type PmsRole = (typeof PMS_ROLES)[number];

export const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);

export const ROLE_LABEL: Record<string, string> = {
  owner: "Owner", admin: "Admin", manager: "Manager", reception: "Reception",
  housekeeper: "Housekeeper", hk_supervisor: "HK Supervisor", maintenance: "Maintenance", outlet_pos: "Outlet / POS",
  // Legacy CM/CRS account roles, shown as-is for identities created in other products.
  revenue_manager: "Revenue Mgr", distribution_manager: "Distribution", read_only: "Read-only",
};

// Outlets that sell POS items (spec §3.7). Minibar is one outlet among several.
export const POS_OUTLETS = ["minibar", "spa", "bar", "restaurant"] as const;
export type PosOutlet = (typeof POS_OUTLETS)[number];
export const POS_OUTLET_LABEL: Record<string, string> = { minibar: "Minibar", spa: "Spa", bar: "Bar", restaurant: "Restaurant" };

// Scoped roles see only part of the PMS — the housekeeper mobile view (§3.4) and the outlet-only
// posting view (§3.7). Any role not listed here has full access. Drives BOTH the sidebar filter and
// the layout route-guard, so typing a URL can't escape the scope.
export const SCOPED_NAV: Record<string, string[]> = {
  housekeeper: ["/housekeeping"],
  hk_supervisor: ["/housekeeping", "/rooms", "/maintenance"],
  maintenance: ["/maintenance", "/rooms"],
  outlet_pos: ["/minibar"],
};
export function roleHome(role: string): string {
  return SCOPED_NAV[role]?.[0] ?? "/dashboard";
}
export function roleAllowsPath(role: string, pathname: string): boolean {
  const allowed = SCOPED_NAV[role];
  if (!allowed) return true; // full-access role
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
} satisfies Record<string, readonly string[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

export function roleHasCapability(role: string, cap: Capability): boolean {
  return (CAPABILITY_ROLES[cap] as readonly string[]).includes(role);
}
