/**
 * Which product a role may OPEN. Reads, not writes.
 *
 * ## The hole this closes
 *
 * `capabilities.ts` gates writes and says, correctly, that read scoping is RLS's job. RLS enforces
 * **tenant** isolation: it stops Hotel Sofia reading Black Sea Resort. It cannot help with the other
 * question, because a housekeeper and an owner at the same hotel are the same tenant and RLS hands
 * them identical rows. Who, *inside* one hotel, may see what is a role question, and until now only
 * RevioPMS asked it.
 *
 * The accounts are **one shared identity across the platform** — that is the product's central claim
 * and the reason a hotel can add a second product with no migration. It is also what makes this
 * sharp: a housekeeper created in RevioPMS holds an account that RevioCRS will happily authenticate.
 * Neither RevioLink nor RevioCRS filtered a single screen by role, so that account could read every
 * guest, every rate and every booking in the hotel. Nothing was hidden from it but the writes.
 *
 * It runs the other way too, and that half was easier to miss: `roleAllowsPath` in RevioPMS ends
 * `if (!allowed) return true; // full-access role`, so a role it has never heard of is treated as a
 * manager. A `revenue_manager` — someone hired to price rooms — opened RevioPMS with folios, guest
 * identities and Close Day.
 *
 * Found on 2026-09-14 by the founder, before either had shipped to a customer, and the way it was
 * put is the requirement: *"a housekeeper tried to search something and it pops something from the
 * admin point of view and somehow she can bridge the system and go to places where she has no
 * access."*
 *
 * ## The rule
 *
 * **Default deny, in both directions.** A role belongs to the products its job exists in. Owner and
 * admin run the hotel and belong everywhere; everything else is earned by name, and a role nobody
 * has mapped gets nothing rather than everything.
 *
 * This decides only whether the door opens. Inside RevioPMS, `SCOPED_NAV` still decides which
 * screens a housekeeper sees — that is a finer question and it stays where it is.
 */

import { COMMERCIAL_ROLES, type CommercialRole } from "./capabilities.js";

/** Roles that exist only inside RevioPMS's operation — the spec's §3.9 list, less owner/admin. */
export const OPERATIONAL_ROLES = [
  "manager",
  "reception",
  "housekeeper",
  "hk_supervisor",
  "maintenance",
  "outlet_pos",
] as const;
export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];

/**
 * Every role RevioPMS knows.
 *
 * ⚠️ Defined here and imported by `apps/pms/lib/roles.ts` rather than listed in both. A second copy
 * of a role list is the copy that goes stale, and a role missing from one of them is exactly the
 * "unknown role" this module exists to refuse.
 */
export const PMS_ROLES = ["owner", "admin", ...OPERATIONAL_ROLES] as const;
export type PmsRole = (typeof PMS_ROLES)[number];

/** The three products a hotel signs into. The operator console has its own perimeter entirely. */
export type HotelProduct = "cm" | "crs" | "pms";

/**
 * Who may open which product.
 *
 * `read_only` is in the commercial list and belongs in RevioLink and RevioCRS: the name promises
 * someone who may look at everything and change nothing, and that is a real job — an accountant, an
 * owner's partner, a consultant mid-audit. It is deliberately NOT given RevioPMS, whose screens are
 * a guest's identity document, their bill and where they are sleeping tonight.
 */
const PRODUCT_ROLES: Record<HotelProduct, readonly string[]> = {
  cm: COMMERCIAL_ROLES,
  crs: COMMERCIAL_ROLES,
  pms: PMS_ROLES,
};

/**
 * May this role open this product at all?
 *
 * Takes `string` for the same reason `roleCan` does: the value comes from a database column that
 * holds every product's roles, and forcing a cast at each call site is how default-deny gets cast
 * away.
 */
export function roleCanOpenProduct(role: string, product: HotelProduct): boolean {
  return PRODUCT_ROLES[product].includes(role);
}

/** Products this role may open — for a permissions matrix, without re-deriving the rule. */
export function productsForRole(role: string): HotelProduct[] {
  return (["cm", "crs", "pms"] as const).filter((p) => roleCanOpenProduct(role, p));
}

export type { CommercialRole };

/**
 * How every role is spelled to a human, in every product.
 *
 * ⚠️ One map, because there were three and they had already diverged in the way that matters: the
 * RevioLink and RevioCRS copies listed only the five commercial roles, so the moment those apps had
 * to name a RevioPMS role — which is exactly what happens on the screen that turns a housekeeper
 * away — they would have printed the raw database value `housekeeper` at her. A role's name is a
 * platform fact, not a per-app opinion.
 */
export const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  // Commercial (RevioLink · RevioCRS)
  revenue_manager: "Revenue Mgr",
  distribution_manager: "Distribution",
  read_only: "Read-only",
  // Operational (RevioPMS)
  manager: "Manager",
  reception: "Reception",
  housekeeper: "Housekeeper",
  hk_supervisor: "HK Supervisor",
  maintenance: "Maintenance",
  outlet_pos: "Outlet / POS",
};

/** The label, falling back to the stored value so an unmapped role is still legible on screen. */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}
