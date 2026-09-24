import { redirect } from "next/navigation";
import { ActivityTable, ActivityFilters } from "@revio/ui/activity-table";
import { getSession } from "@/lib/session";
import { roleHasCapability } from "@/lib/roles";
import { getActivity } from "@/lib/activity";
import { activeProperty } from "@/lib/data";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { pages } from "@/lib/i18n/pages";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; actor?: string; auto?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // An audit log shows money, guests and configuration in one place. Managers only.
  if (!roleHasCapability(session.role, "manage")) redirect("/dashboard?error=forbidden");

  const sp = await searchParams;
  const includeAutomatic = sp.auto === "1";
  const view = await getActivity({ from: sp.from, to: sp.to, actorId: sp.actor, includeAutomatic });

  const { t: tr, locale } = await i18n();
  const t = tr(pages).activity;
  const { property } = await activeProperty();
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
        <CardHeader title={t.changes} subtitle={t.changesSub(view.from, view.to)} />
        <ActivityTable
          view={view}
          showAutomaticHref={`/activity?${showAuto.toString()}`}
          labels={{ automaticNote: t.automaticNote }}
          locale={locale}
          timeZone={property.timezone}
        />
      </Card>
    </div>
  );
}
