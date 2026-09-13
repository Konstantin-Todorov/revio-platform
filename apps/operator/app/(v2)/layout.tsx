import { redirect } from "next/navigation";
import { getOperatorSession } from "@/lib/session";
import { getOverviewStats, getClients } from "@/lib/data";
import { V2Shell } from "@/components/v2/V2Shell";
import "../v2.css";

/**
 * The candidate design's own route group.
 *
 * ⚠️ It deliberately does NOT reuse `(protected)/layout.tsx` — that supplies the current sidebar and
 * topbar, and rendering a new shell inside the old one shows neither honestly. What it DOES reuse is
 * the thing that matters: the same `getOperatorSession()` guard.
 *
 * The nav counts and the palette's contents are fetched HERE rather than per page, so every v2
 * screen shows the same numbers in the chrome — a rail whose badge changes depending on which page
 * you are standing on is worse than no badge.
 *
 * Nothing outside `app/(v2)/`, `app/v2-login/`, `app/v2.css` and `components/v2/` exists for this.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const session = await getOperatorSession();
  if (!session) redirect("/logout");

  const [stats, clients] = await Promise.all([getOverviewStats(), getClients()]);

  return (
    <V2Shell
      counts={{ hotels: stats.clients, errors: stats.openErrors }}
      search={[
        ...clients.filter((c) => !c.isDemo).map((c) => ({
          g: "Hotels", t: c.name, s: `${c.plan} · ${c.counts.units} rooms`, h: `/clients/${c.id}`,
        })),
        { g: "Go to", t: "Home", s: "The morning screen", h: "/v2" },
        { g: "Go to", t: "Hotels", s: "Every client and what they hold", h: "/v2/clients" },
        { g: "Go to", t: "Invoices", s: "Drafts, sent and paid", h: "/v2/billing" },
        { g: "Go to", t: "Platform health", s: "Errors and sync", h: "/v2/health" },
      ]}
    >
      {children}
    </V2Shell>
  );
}
