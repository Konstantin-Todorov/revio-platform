import "server-only";
import { redirect } from "next/navigation";
import { roleCan, refusalMessage, type Capability } from "@revio/core";
import { getSession, type Session } from "./session";

/**
 * The capability gate for every write in this app (X2).
 *
 * ## Why hiding a button is not access control
 *
 * A server action is a POST endpoint with a generated name. Next runs the action **first** and
 * re-renders the page — and therefore re-runs any layout guard — **afterwards**. So a redirect in a
 * layout fires after the mutation has already committed. Anyone who can sign in can replay any
 * action in this app unless the action itself asks.
 *
 * Before this file existed, exactly one action in RevioLink checked a role: `inviteUser`. A
 * `read_only` account could re-price a season, close the property out on every channel, or cancel a
 * booking, because every other action simply did the work.
 *
 * ## How to use it
 *
 * Every action that writes calls one of these two first, before reading FormData and before touching
 * the database. Which one depends only on how the action reports failure:
 *
 *   - `requireCapability(cap)` for actions typed `Promise<void>` — it redirects, which throws, so
 *     nothing after it runs.
 *   - `guard(cap)` for actions that return an `ActionResult`, so the form can show the reason
 *     instead of bouncing the user to a page with no explanation.
 *
 * The policy itself lives in `@revio/core/auth/capabilities` — pure, unit-tested, and shared with
 * RevioCRS, because the roles are one shared identity across the platform.
 */

/**
 * Gate a `Promise<void>` action. Redirects on refusal, which throws, so the caller stops here.
 *
 * Refusal goes to the dashboard rather than to `/login`: the person IS signed in, and sending them
 * to a login form to explain a permissions problem is the kind of small lie that generates support
 * tickets.
 */
export async function requireCapability(cap: Capability): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roleCan(session.role, cap)) {
    redirect(`/dashboard?denied=${encodeURIComponent(refusalMessage(session.role, cap))}`);
  }
  return session;
}

/**
 * Gate an action that returns a result object. Returns the refusal instead of redirecting, so the
 * form the user is looking at can say why.
 */
export async function guard(
  cap: Capability,
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again." };
  if (!roleCan(session.role, cap)) {
    return { ok: false, error: refusalMessage(session.role, cap) };
  }
  return { ok: true, session };
}
