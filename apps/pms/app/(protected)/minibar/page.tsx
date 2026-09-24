import Link from "next/link";
import { ChevronRight, DoorOpen } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { listFolios } from "@/lib/folio";
import { i18n } from "@/lib/i18n/server";
import { extras } from "@/lib/i18n/extras";
import { ExtrasTabs } from "@/components/extras/ExtrasTabs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { roleHasCapability } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function MinibarPage() {
  const session = await getSession();
  const [{ rows }, catalogCount] = await Promise.all([
    listFolios(),
    session ? prisma.posItem.count({ where: { propertyId: session.activePropertyId } }) : Promise.resolve(0),
  ]);
  const { t, money } = await i18n();
  const s = t(extras);

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      {/* Only somebody who may change the catalog is offered it — an outlet account only charges. */}
      {session && roleHasCapability(session.role, "manage") && <ExtrasTabs active="post" t={s.tabs} catalogCount={catalogCount} />}

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[14px] font-semibold text-ink-900">{s.noRooms}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-ink-500">
            {s.noRoomsBefore}{" "}
            <Link href="/dashboard" className="font-semibold text-accent-600 underline">{s.frontDesk}</Link>{s.noRoomsAfter === "." ? "." : ` ${s.noRoomsAfter}`}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link key={r.reservationId} href={`/minibar/${r.reservationId}`} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-white p-3.5 shadow-card transition-colors hover:bg-surface-muted">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600"><DoorOpen className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold tracking-tight text-ink-900">{r.units.join(", ") || "—"}</div>
                  <div className="truncate text-[11.5px] text-ink-500">{r.guestName}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.balance != null && r.balance > 0 && <span className="tnum text-[11.5px] font-semibold text-ink-400">{money(r.balance, r.currency)}</span>}
                <ChevronRight className="h-4 w-4 text-ink-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
