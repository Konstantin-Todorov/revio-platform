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
