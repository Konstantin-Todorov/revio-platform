import "server-only";
import { getSession, type Session } from "./session";
import { roleHasCapability, type Capability } from "./roles";

/**
 * Capability gate for server actions.
 *
 * The sidebar hides screens a scoped role can't use, and the protected layout redirects if one types
 * the URL — but neither protects a WRITE. A server action is a POST endpoint: Next runs the action
 * first and re-renders (and therefore re-guards) afterwards, so the layout redirect fires only after
 * the mutation has already committed. A housekeeper account could post a payment or check a guest
 * out without ever loading the screen.
 *
 * So every action that moves money, occupancy or configuration asks here first. The policy itself
 * lives in `roles.ts` (plain module, unit-tested); this file only binds it to the session.
 */
export async function requireCapability(cap: Capability): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (!session.entitlements.pms) return null;
  return roleHasCapability(session.role, cap) ? session : null;
}
