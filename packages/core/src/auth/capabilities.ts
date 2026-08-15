/**
 * Who may perform a write in RevioLink and RevioCRS (X2).
 *
 * ## The hole this closes
 *
 * The role on a session decided what the *sidebar* rendered and nothing else. Every server action in
 * RevioLink and RevioCRS — 110 of them — ran whatever the caller asked, with exactly two exceptions
 * (`actions-users.ts` in each app, which checked owner/admin before touching staff).
 *
 * A server action is a POST endpoint. Hiding the button that calls it protects nobody: a `read_only`
 * account could re-price a season, close a property out on every channel, or cancel a booking, by
 * replaying a request the UI would never have offered them. The permissions matrix the product
 * advertises was, for these two apps, decoration.
 *
 * RevioPMS already did this properly — `apps/pms/lib/roles.ts` has had a capability map and a
 * `requireCapability` guard since it shipped. This module is the same idea for the commercial roles,
 * and it lives in `@revio/core` rather than in one app because two apps need it and an app may never
 * import another app's internals.
 *
 * ## The two rules
 *
 * **Default deny.** `roleCan` returns false for any role it does not recognise. A PMS housekeeper
 * holds an account on the same shared identity and can sign in to RevioCRS; they get nothing there,
 * and so does a role somebody adds next year and forgets to map.
 *
 * **Reads are not gated here.** This is about writes. Read scoping is RLS's job, and a second,
 * weaker copy of it in application code would be the thing people trust by mistake.
 */

/** The commercial roles, as stored on `User.role`. PMS operational roles are deliberately absent. */
export const COMMERCIAL_ROLES = [
  "owner",
  "admin",
  "revenue_manager",
  "distribution_manager",
  "read_only",
] as const;
export type CommercialRole = (typeof COMMERCIAL_ROLES)[number];

/**
 * What a write touches. Named after the thing at risk, not after the screen it lives on — screens
 * get renamed and merged, and a capability that tracks a screen name drifts away from its meaning.
 */
export type Capability =
  /** Staff accounts, roles, invitations, deactivation. */
  | "manageStaff"
  /** Property settings, taxes and fees, invoicing identity, branding, booking-engine configuration. */
  | "manageSettings"
  /** Prices, rate plans, restrictions, bulk edits. The money. */
  | "manageRates"
  /** Availability: the calendar, rooms to sell, closures, room types. */
  | "manageInventory"
  /** Channels, mapping, connection state, manual pushes and pulls. */
  | "manageDistribution"
  /** Creating, modifying, cancelling bookings; holds; guest records. */
  | "manageReservations";

/**
 * Role → capabilities.
 *
 * `revenue_manager` deliberately does NOT get `manageDistribution`, and `distribution_manager` does
 * NOT get `manageRates`. That split is the entire reason those two roles exist as separate things:
 * one decides what a room costs, the other decides where it is sold. Collapsing them would leave the
 * product with two role names and one meaning.
 *
 * `read_only` maps to an empty list, which is what the name has always promised and has never until
 * now delivered.
 */
const GRANTS: Record<CommercialRole, readonly Capability[]> = {
  owner: [
    "manageStaff",
    "manageSettings",
    "manageRates",
    "manageInventory",
    "manageDistribution",
    "manageReservations",
  ],
  admin: [
    "manageStaff",
    "manageSettings",
    "manageRates",
    "manageInventory",
    "manageDistribution",
    "manageReservations",
  ],
  revenue_manager: ["manageRates", "manageInventory", "manageReservations"],
  distribution_manager: ["manageDistribution", "manageInventory"],
  read_only: [],
};

/**
 * May this role perform this kind of write?
 *
 * Takes `string`, not `CommercialRole`, on purpose: the value arrives from a database column that
 * also holds PMS operational roles, and forcing a cast at every call site would turn "this role is
 * unknown" into "this cast is annoying" — which is how default-deny gets cast away.
 */
export function roleCan(role: string, cap: Capability): boolean {
  const grants = GRANTS[role as CommercialRole];
  return grants ? grants.includes(cap) : false;
}

/** Every capability a role holds. For rendering a permissions matrix without re-deriving the rules. */
export function capabilitiesOf(role: string): readonly Capability[] {
  return GRANTS[role as CommercialRole] ?? [];
}

/** True when a role may perform no writes at all — used to show a read-only banner rather than to gate. */
export function isReadOnly(role: string): boolean {
  return capabilitiesOf(role).length === 0;
}

/**
 * What to tell someone who was refused.
 *
 * Deliberately says what the account cannot do rather than what the screen requires: the person
 * reading it usually cannot change their own role, so the useful next step is "ask whoever can",
 * not the name of a permission.
 */
export function refusalMessage(role: string, cap: Capability): string {
  const what: Record<Capability, string> = {
    manageStaff: "manage staff accounts",
    manageSettings: "change property settings",
    manageRates: "change rates or restrictions",
    manageInventory: "change availability",
    manageDistribution: "change channel connections",
    manageReservations: "create or change reservations",
  };
  if (isReadOnly(role)) {
    return `Your account has read-only access, so it cannot ${what[cap]}. Ask an owner or admin at your property to change your role.`;
  }
  return `Your account cannot ${what[cap]}. Ask an owner or admin at your property if you need to.`;
}
