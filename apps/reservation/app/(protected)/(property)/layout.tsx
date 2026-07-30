import { PickProperty } from "@/components/shell/PickProperty";
import { getSession, getSwitchableProperties } from "@/lib/session";
import { redirect } from "next/navigation";

/**
 * The route group for screens that configure or operate **one hotel**.
 *
 * Portfolio scope ("All properties") is a reporting lens — it answers "how is the group doing?".
 * The screens in here answer "what should this hotel do?", and in portfolio scope
 * `session.activePropertyId` silently resolves to whichever property sorts first. Before this guard
 * they still rendered, so a user looking at "All properties" would have been editing one specific
 * hotel without being told which. On the Booking Engine that write is a permanent public address.
 *
 * A route group rather than a check inside each page: a screen added to this folder inherits the
 * protection instead of having to remember it, and the URLs are unchanged because `(property)` is a
 * grouping folder, not a path segment.
 *
 * This is the *render* half. The write half lives in the actions — see `assertSingleProperty` — for
 * the same reason a disabled button is not authorization.
 */
export default async function PropertyScopedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");
  if (session.scope !== "group") return <>{children}</>;

  const properties = await getSwitchableProperties(session.tenantId);
  return <PickProperty properties={properties.map((p) => ({ id: p.id, name: p.name }))} />;
}
