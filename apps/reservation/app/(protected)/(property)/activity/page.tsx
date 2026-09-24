import { redirect } from "next/navigation";
import { ActivityTable, ActivityFilters } from "@revio/ui/activity-table";
import { getActivity } from "@/lib/activity";
import { getProperty } from "@/lib/data";
import { guard } from "@/lib/authz";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; actor?: string; auto?: string }> }) {
  // A change log shows rates, settings and guest data in one place — the same bar as managing them.
  const g = await guard("manageSettings");
  if (!g.ok) redirect("/dashboard");

  const sp = await searchParams;
  const includeAutomatic = sp.auto === "1";
  const [view, property] = await Promise.all([
    getActivity({ from: sp.from, to: sp.to, actorId: sp.actor, includeAutomatic }),
    getProperty(),
  ]);

  const { t: tr, locale } = await i18n();
  const t = tr(pages).activity;
  const showAuto = new URLSearchParams({ from: view.from, to: view.to, auto: "1" });
  if (sp.actor) showAuto.set("actor", sp.actor);

  return (
    <div>
      <PageHeader
        title={t.title}
        subtitle={t.subtitle(view.rows.length)}
      />
      <ActivityFilters view={view} currentActor={sp.actor} includeAutomatic={includeAutomatic} locale={locale} />
      <Card>
        <CardHeader
          title={t.changes}
          subtitle={t.changesSub(view.from, view.to)}
        />
        <ActivityTable
          view={view}
          showAutomaticHref={`/activity?${showAuto.toString()}`}
          labels={{ automaticNote: t.automaticNote }}
          locale={locale}
          // The property's clock, not the server's UTC one.
          timeZone={property.timezone}
        />
      </Card>
    </div>
  );
}
