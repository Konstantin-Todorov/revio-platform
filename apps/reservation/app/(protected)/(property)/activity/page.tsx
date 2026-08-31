import { redirect } from "next/navigation";
import { ActivityTable, ActivityFilters } from "@revio/ui/activity-table";
import { getActivity } from "@/lib/activity";
import { guard } from "@/lib/authz";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; actor?: string; auto?: string }> }) {
  // A change log shows rates, settings and guest data in one place — the same bar as managing them.
  const g = await guard("manageSettings");
  if (!g.ok) redirect("/dashboard");

  const sp = await searchParams;
  const includeAutomatic = sp.auto === "1";
  const view = await getActivity({ from: sp.from, to: sp.to, actorId: sp.actor, includeAutomatic });

  const showAuto = new URLSearchParams({ from: view.from, to: view.to, auto: "1" });
  if (sp.actor) showAuto.set("actor", sp.actor);

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={`${view.rows.length} change${view.rows.length === 1 ? "" : "s"} · who changed what, and when`}
      />
      <ActivityFilters view={view} currentActor={sp.actor} includeAutomatic={includeAutomatic} />
      <Card>
        <CardHeader
          title="Changes"
          subtitle={`${view.from} → ${view.to} · newest first · one history for this property, whichever product wrote it`}
        />
        <ActivityTable
          view={view}
          showAutomaticHref={`/activity?${showAuto.toString()}`}
          labels={{ automaticNote: "channel syncs the software made by itself. They have their own screen in RevioLink." }}
        />
      </Card>
    </div>
  );
}
