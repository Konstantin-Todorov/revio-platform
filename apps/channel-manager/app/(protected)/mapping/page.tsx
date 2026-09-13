import { Fragment } from "react";
import Link from "next/link";
import { AlertTriangle, Link2 } from "lucide-react";
import { getMapping, getUnmappedBookingAlerts } from "@/lib/data";
import { listChannelProducts } from "@/lib/connectivity";
import { fixMappings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { MappingEditDialog } from "@/components/mapping/MappingEditDialog";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = { complete: "success", incomplete: "warning", never_sent: "danger" };
/*
 * ⚠️ Words, not database values. The rows for products the channel has never received carry
 * `never_sent`, and printing that raw would put a column name in front of a hotelier. "Not sent yet"
 * says the same thing and tells them it is a thing to finish rather than a fault they caused.
 */
const STATUS_LABEL: Record<string, string> = {
  complete: "mapped",
  incomplete: "needs an id",
  never_sent: "not sent yet",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const sp = await searchParams;
  const { channels, channel, roomTypeMappings, ratePlanMappings, neverSent, mappingCollisions } = await getMapping(sp.ch);

  if (!channel) {
    return (
      <div>
        <PageHeader title="Mapping" subtitle="Link your room types and rate plans to each channel's own listings" />
        <EmptyState
          icon={<Link2 className="h-7 w-7" />}
          title="No channels connected yet"
          body="Mapping links your room types and rate plans to each channel's own IDs. Connect a channel first, then map them here."
          actionLabel="Connect a channel"
          actionHref="/channels"
        />
      </div>
    );
  }

  const incomplete =
    roomTypeMappings.filter((m) => m.status !== "complete").length +
    ratePlanMappings.filter((m) => m.status !== "complete").length;

  // The channel's own products (spec §3.6) — dropdown options + the pulled product codes.
  const products = await listChannelProducts(channel.id);
  // Unmapped-booking alerts: bookings Channex flagged because their room/rate isn't mapped —
  // each deep-links to the exact row that needs attention.
  const alerts = await getUnmappedBookingAlerts(channel.id);

  return (
    <div>
      <PageHeader title="Mapping" subtitle="Room types carry how many rooms are free. Rate plans carry prices and restrictions. Both need linking." />
      {(products.rooms.length > 0 || products.rates.length > 0) && (
        <p className="-mt-3 mb-3 text-[11.5px] text-ink-400">
          {products.rooms.length + products.rates.length} products pulled from {channel.name} — pick them from the dropdown when mapping.
        </p>
      )}

      {/*
        ⚠️ Two of our room types pointing at ONE Channex rate plan.
        
        One Channex rate plan belongs to exactly one room type, so this means one room's prices
        overwrite the other's on every push — the later one wins and nothing else says so. Found in
        production on 13 Sept: the inactive Standard Rate held two rows, for two different rooms,
        both on 0ea321e7…. It is shown rather than blocked, because a hotel may be mid-way through
        re-mapping and a screen that refuses to render is a hotel with no way to fix itself.
      */}
      {mappingCollisions.length > 0 && (
        <div className="mb-3 rounded-md border border-danger-600/30 bg-danger-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-danger-700">
            <AlertTriangle className="h-4 w-4" />
            {mappingCollisions.length === 1 ? "One channel rate plan is" : `${mappingCollisions.length} channel rate plans are`} mapped to more than one room
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-danger-700">
            {mappingCollisions.map((c) => (
              <li key={c.externalId}>
                <span className="tnum">{c.externalId.slice(0, 8)}…</span> is used by{" "}
                {c.rooms.map((r) => `${r.roomTypeName} · ${r.ratePlanName}`).join(" and ")} — whichever pushes last
                overwrites the other. Give each room its own rate plan.
              </li>
            ))}
          </ul>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-3 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-warning-700">
            <AlertTriangle className="h-4 w-4" /> {alerts.length} booking{alerts.length > 1 ? "s" : ""} arrived for an unmapped product
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-warning-700">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.message}
                {a.anchor ? (
                  <a href={`#${a.anchor}`} className="ml-1.5 font-semibold underline">jump to the row</a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/mapping?ch=${c.code}`}
              className={`rounded-md border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                c.id === channel.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-ink-500 hover:bg-surface-muted"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        {incomplete > 0 ? (
          <form action={fixMappings}>
            <input type="hidden" name="channelId" value={channel.id} />
            <button type="submit" className="rounded-md bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">
              Auto-fix {incomplete} unmapped
            </button>
          </form>
        ) : neverSent.length > 0 ? (
          /*
            "All mapped" counted mapping ROWS that are not `complete`. A product that never reached
            this channel has no row, so it made the count zero and this pill green — the hotel was
            told everything was mapped while selling a room no OTA can see. Absence and
            incompleteness are different questions and only one of them can be counted in rows.
          */
          <span title={neverSent.map((p) => p.name).join(", ")}>
            <StatusPill tone="danger">
              {neverSent.length} never sent
            </StatusPill>
          </span>
        ) : (
          /* health-lint: proven above — this branch is reached only when BOTH `incomplete` (rows
             not finished) and `neverSent` (products with no row at all) are zero. Those are two
             different questions and the second is the one a row count cannot answer. */
          <StatusPill tone="success">All mapped</StatusPill>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Room Types stream — inventory + open/close */}
        <Card>
          <CardHeader title={`Room Types · ${channel.name}`} action={<span className="text-[11px] text-ink-400">inventory & open/close</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {["Room Type", "External Room ID", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {roomTypeMappings.map((m) => (
                  <tr key={m.productId} id={`map-room-${m.productId}`} className="group border-b border-surface-border/60 transition-colors last:border-0 target:bg-warning-50 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{m.roomType.name}</td>
                    <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRoomId ?? <span className="text-danger-500">—</span>}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{STATUS_LABEL[m.status] ?? m.status}</StatusPill></td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <MappingEditDialog kind="room" id={m.id} productId={m.productId} label={m.roomType.name} externalId={m.externalRoomId} channelName={channel.name} channelId={channel.id} options={products.rooms} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Rate Plans stream — rates + restrictions */}
        <Card>
          <CardHeader title={`Rate Plans · ${channel.name}`} action={<span className="text-[11px] text-ink-400">rates & restrictions</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {["Rate Plan", "External Rate ID", "Status"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {/*
                  ⚠️ GROUPED BY ROOM TYPE, because that is how Channex holds rate plans.

                  This was one row per rate plan for the whole property, and a property-wide row
                  cannot express a per-room model: one Revio plan points at one Channex plan, and
                  that plan belongs to one room. So all three room types' prices funnelled into a
                  single room's rate plan — proven on 13 September, when €666 set on the 1-Bedroom
                  was published against the 2-Bedroom with no error anywhere.

                  Reading the room name above its plans is also the whole of §4.3 rule 6: the
                  sentence "Apartment, 1 Bedroom · BB Flex → …" would have made that fault visible
                  in one glance.
                */}
                {Object.entries(
                  ratePlanMappings.reduce<Record<string, typeof ratePlanMappings>>((acc, m) => {
                    (acc[m.roomTypeName] ??= []).push(m);
                    return acc;
                  }, {}),
                ).map(([roomName, rows]) => (
                  <Fragment key={roomName}>
                    <tr className="border-b border-surface-border/60 bg-surface-muted/60">
                      <td colSpan={4} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                        {roomName}
                        {rows.some((r) => r.unmapped) && (
                          <span className="ml-2 font-semibold normal-case text-warning-700">
                            {rows.filter((r) => r.unmapped).length} to confirm
                          </span>
                        )}
                      </td>
                    </tr>
                    {rows.map((m) => (
                      <tr
                        key={`${m.roomTypeId}-${m.ratePlanId}`}
                        id={`map-rate-${m.ratePlanId}`}
                        className="group border-b border-surface-border/60 transition-colors last:border-0 target:bg-warning-50 hover:bg-surface-muted"
                      >
                        <td className="px-4 py-2.5 pl-7 font-semibold text-ink-900">{m.ratePlan.name}</td>
                        <td className="tnum px-4 py-2.5 text-ink-500">
                          {m.externalRateId ?? <span className="text-danger-500">—</span>}
                          {/*
                            What a property-wide row is publishing to right now. Shown so the hotel
                            can see where its prices ARE going — and deliberately not offered as the
                            value to save, because for this room that id is another room's plan.
                          */}
                          {m.fromCatchAll && m.inheritedExternalId && (
                            <span className="mt-0.5 block text-[10.5px] leading-tight text-warning-700">
                              currently publishing to {m.inheritedExternalId.slice(0, 8)}… — set for this room
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{STATUS_LABEL[m.status] ?? m.status}</StatusPill>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                            <MappingEditDialog
                              kind="rate" id={m.id} productId={m.productId}
                              label={`${m.roomTypeName} · ${m.ratePlan.name}`}
                              externalId={m.externalRateId}
                              channelName={channel.name} channelId={channel.id}
                              roomTypeId={m.roomTypeId}
                              options={products.rates}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
