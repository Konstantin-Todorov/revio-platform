import { redirect } from "next/navigation";
import { HelpCentre } from "@revio/ui/help-centre";

export const dynamic = "force-dynamic";

/**
 * Help's articles. `?tab=requests` is where "Your requests" used to live, and emails and bookmarks
 * still carry it — so it goes to the section's own address rather than to the wrong one.
 */
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if ((await searchParams).tab === "requests") redirect("/help/requests");
  return <HelpCentre product="pms" />;
}
