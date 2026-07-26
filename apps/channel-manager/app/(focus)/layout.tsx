import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Focus mode: authenticated, but with no sidebar and no topbar.
 *
 * Editing the wording a guest receives is close work — the founder's brief was that while you're in
 * it you should be *only* in it. So this route group keeps the auth and entitlement guarantees of
 * the shell and drops the navigation, leaving one deliberate way out.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");
  if (!session.entitlements.channelManager) redirect("/dashboard");

  return <div className="min-h-screen bg-surface-muted">{children}</div>;
}
