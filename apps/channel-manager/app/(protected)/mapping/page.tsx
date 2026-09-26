import { Fragment } from "react";
import Link from "next/link";
import { AlertTriangle, Link2 } from "lucide-react";
import { crossWiredRatePlans } from "@revio/core";
import { mappableRatePlans, ratePlansForRoom, type ChannexRatePlan } from "@revio/connectivity";
import { getMapping, getUnmappedBookingAlerts } from "@/lib/data";
import { listChannelProducts } from "@/lib/connectivity";
import { fixMappings } from "@/lib/actions-config";
import { Card, CardHeader, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { MappingEditDialog } from "@/components/mapping/MappingEditDialog";
import { VerifyStrip } from "@/components/mapping/VerifyStrip";
import { SendToChannex } from "@/components/mapping/SendToChannex";
import { i18n } from "@/lib/i18n/server";
import { mapping as mappingDict } from "@/lib/i18n/mapping";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = { complete: "success", incomplete: "warning", never_sent: "danger" };
/*
 * ⚠️ Words, not database values. The rows for products the channel has never received carry
 * `never_sent`, and printing that raw would put a column name in front of a hotelier. "Not sent yet"
 * says the same thing and tells them it is a thing to finish rather than a fault they caused.
 */
// The words are `status` in lib/i18n/mapping.ts.

export default async function Page({ searchParams }: { searchParams: Promise<{ ch?: string }> }) {
  const sp = await searchParams;
  const [{ channels, channel, roomTypeMappings, ratePlanMappings, neverSent, mappingCollisions }, { t }] = await Promise.all([getMapping(sp.ch), i18n()]);
  const s = t(mappingDict);
  const statusLabel = (st: string) => s.status[st as keyof typeof s.status] ?? st;

  if (!channel) {
    return (
      <div>
        <PageHeader title={s.title} subtitle={s.empty.subtitle} />
        <EmptyState
          icon={<Link2 className="h-7 w-7" />}
          title={s.empty.title}
          body={s.empty.body}
          actionLabel={s.empty.action}
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

  /*
   * ⚠️ WHICH OF THE CHANNEL'S PLANS THIS ROOM MAY BE OFFERED.
   *
   * The dropdown listed every rate plan in the property, flat. A Channex property with three
   * apartments has three plans called "BB BAR" differing only by a UUID, so picking the right one
   * was a coin toss with no feedback: the row goes green, the push succeeds, and one room's prices
   * publish against another. `ratePlansForRoom` and `mappableRatePlans` were written for this on
   * 13 September and had **no callers** — the adapter carried `room_type_id` and the
   * `listChannelProducts` seam declared `{id, name}`, which deleted it on the way through.
   */
  const catalogue: ChannexRatePlan[] = products.rates.map((r) => ({
    id: r.id,
    name: r.name,
    roomTypeId: r.roomTypeId ?? null,
    kind: r.kind ?? "property",
    derived: r.derived ?? false,
    ...(r.channel ? { channel: r.channel } : {}),
  }));
  const { mappable, derived, excluded } = mappableRatePlans(catalogue);

  /** Our room type → the channel's room id it is mapped to. Nothing about a rate plan can be judged without it. */
  const channexRoomOf = new Map(
    roomTypeMappings.flatMap((m) => (m.externalRoomId ? [[m.productId, m.externalRoomId] as const] : [])),
  );
  const channelRoomName = new Map(products.rooms.map((r) => [r.id, r.name] as const));

  /*
   * A channel that never says which room a plan belongs to (our mock, and the demo hotels with it)
   * is not scoping by room, so filtering to nothing would take a working dropdown away. Offer
   * everything then, and say nothing about cross-wiring — unknown is not wrong.
   */
  const scopesByRoom = mappable.some((p) => p.roomTypeId != null);
  /*
   * ⚠️ Derived plans are OFFERED, marked — not hidden.
   *
   * `mappableRatePlans` keeps them out of `mappable` because nothing is pushed to a plan the channel
   * computes from a parent. That is the right default and the wrong absolute: Cabacum has its three
   * "BB Non-Refundable" rows mapped to derived plans today, and a dropdown that silently drops them
   * is a screen where a hotel cannot re-pick the mapping it already has. Hiding a choice does not
   * unmake it; it only removes the place to reason about it.
   *
   * So they appear, last, saying what they are. The channel-scoped ones stay out — those are the OTA
   * end of the chain and binding to one skips a hop that exists for a reason.
   */
  const ratesForRoom = (roomTypeId: string): { id: string; name: string }[] => {
    const label = (p: ChannexRatePlan) => ({ id: p.id, name: p.name });
    const marked = (p: ChannexRatePlan) => ({ id: p.id, name: s.derivedOption(p.name) });
    if (!scopesByRoom) return [...mappable.map(label), ...derived.map(marked)];
    const ext = channexRoomOf.get(roomTypeId);
    if (!ext) return [];
    return [...ratePlansForRoom(mappable, ext).map(label), ...ratePlansForRoom(derived, ext).map(marked)];
  };

  /*
   * §4.4's missing half. `collidingExternalIds` below asks whether two of our rooms point at one
   * plan; this asks whether one row points at the plan it claims to — an id used exactly once and
   * still wrong. Only the channel's own `room_type_id` can answer it. Found live on 2026-09-17:
   * `Apartment, 2 Bedrooms · Standard Rate` publishing to the 1-Bedroom's plan.
   */
  /*
   * ⚠️ A plan whose price Revio sets, mapped to a plan the CHANNEL computes.
   *
   * Channex derives such a plan from its parent and ignores the rate we push to it. Everything
   * reports success — the push, the row, the status pill — and the guest on the OTA pays Channex's
   * number, not ours. Found on a real hotel on 2026-09-23 by reading production back: BB
   * Non-Refundable €333 in Revio, €299.70 on Booking.com for 93 nights, because Channex takes it
   * as "BB BAR −10%". RevioDirect quotes €333 for the same night. The screen marked the plan
   * "derived" in the dropdown and never said what that costs.
   */
  const rateById = new Map(products.rates.map((r) => [r.id, r] as const));
  const derivedTargets = ratePlanMappings.flatMap((m) => {
    const target = m.externalRateId ? rateById.get(m.externalRateId) : undefined;
    if (!target?.derived) return [];
    const parent = target.parentId ? rateById.get(target.parentId)?.name : undefined;
    return [{ key: `${m.ratePlanId}-${m.roomTypeName}`, ratePlanId: m.ratePlanId, room: m.roomTypeName, plan: m.ratePlan.name, channelPlan: target.name, parent }];
  });

  const crossWires = crossWiredRatePlans(
    ratePlanMappings.flatMap((m) =>
      m.externalRateId
        ? [{ roomTypeId: m.roomTypeId, roomTypeName: m.roomTypeName, ratePlanName: m.ratePlan.name, externalRateId: m.externalRateId }]
        : [],
    ),
    catalogue.map((c) => ({ id: c.id, title: c.name, externalRoomId: c.roomTypeId })),
    channexRoomOf,
    channelRoomName,
  );

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      {(products.rooms.length > 0 || products.rates.length > 0) && (
        <p className="-mt-3 mb-3 text-[11.5px] text-ink-400">
          {s.pulled(products.rooms.length + products.rates.length, channel.name)}
        </p>
      )}

      {/*
        §4.4 — the only check that reads the destination. Placed above the mapping tables because it
        is what somebody reaches for immediately after mapping, to know it took.
      */}
      <VerifyStrip channelId={channel.id} channelName={channel.name} />

      {/*
        ⚠️ Two of our room types pointing at ONE Channex rate plan.
        
        One Channex rate plan belongs to exactly one room type, so this means one room's prices
        overwrite the other's on every push — the later one wins and nothing else says so. Found in
        production on 13 Sept: the inactive Standard Rate held two rows, for two different rooms,
        both on 0ea321e7…. It is shown rather than blocked, because a hotel may be mid-way through
        re-mapping and a screen that refuses to render is a hotel with no way to fix itself.
      */}
      {/*
        ⚠️ The mapping is finished, green, and pointing at another room.
        
        Everything downstream of this reports success — the push, the status pill, Channex itself —
        because every part of it IS succeeding. The only wrong thing is the destination, and the
        channel's own catalogue is the only place that says so. Leading with the consequence, per
        UI-STANDARD 4b: not "an id does not match" but "those prices are going onto the wrong room".
      */}
      {crossWires.length > 0 && (
        <div className="mb-3 rounded-md border border-danger-600/30 bg-danger-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-danger-700">
            <AlertTriangle className="h-4 w-4" />
            {s.crossWireTitle(crossWires.length, channel.name)}
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-danger-700">
            {crossWires.map((f) => (
              <li key={`${f.roomTypeName}-${f.externalRateId}`}>
                {f.reason === "wrong_room"
                  ? s.crossWire.wrongRoom(f.roomTypeName, f.ratePlanName, f.belongsToRoomName ?? null)
                  : s.crossWire.gone(f.roomTypeName, f.ratePlanName, f.externalRateId)}{" "}
                <a href={`#map-rate-${ratePlanMappings.find((m) => m.externalRateId === f.externalRateId && m.roomTypeName === f.roomTypeName)?.ratePlanId ?? ""}`} className="font-semibold underline">
                  {s.fixRow}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {derivedTargets.length > 0 && (
        <div className="mb-3 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-warning-700">
            <AlertTriangle className="h-4 w-4" />
            {s.derivedTitle(derivedTargets.length, channel.name)}
          </div>
          <p className="mt-1 pl-6 text-[12.5px] text-warning-700">
            {s.derivedBody(channel.name)}
          </p>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-warning-700">
            {derivedTargets.map((d) => (
              <li key={d.key}>
                <span className="font-semibold">{d.room} · {d.plan}</span> → {d.channelPlan}
                {d.parent ? s.derivesFrom(channel.name, d.parent) : ""}{" "}
                <a href={`#map-rate-${d.ratePlanId}`} className="font-semibold underline">{s.seeRow}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mappingCollisions.length > 0 && (
        <div className="mb-3 rounded-md border border-danger-600/30 bg-danger-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-danger-700">
            <AlertTriangle className="h-4 w-4" />
            {s.collisionTitle(mappingCollisions.length)}
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-danger-700">
            {mappingCollisions.map((c) => (
              <li key={c.externalId}>
                <span className="tnum">{c.externalId.slice(0, 8)}…</span> {s.usedBy}{" "}
                {c.rooms.map((r) => `${r.roomTypeName} · ${r.ratePlanName}`).join(s.and)} {s.collisionTail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        The gap was described and not fixable. Provisioning is one-shot, so a room added after the
        channel was connected could never reach Channex from anywhere in the product — and this
        screen told the hotel exactly that, with nothing to press.
      */}
      {neverSent.length > 0 && (
        <div className="mb-3">
          <SendToChannex channelId={channel.id} products={neverSent.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))} />
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-3 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-warning-700">
            <AlertTriangle className="h-4 w-4" /> {s.alertsTitle(alerts.length)}
          </div>
          <ul className="mt-1.5 space-y-1 pl-6 text-[12.5px] text-warning-700">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.message}
                {a.anchor ? (
                  <a href={`#${a.anchor}`} className="ml-1.5 font-semibold underline">{s.jumpToRow}</a>
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
              {s.autofix(incomplete)}
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
              {s.neverSent(neverSent.length)}
            </StatusPill>
          </span>
        ) : (
          /* health-lint: proven above — this branch is reached only when BOTH `incomplete` (rows
             not finished) and `neverSent` (products with no row at all) are zero. Those are two
             different questions and the second is the one a row count cannot answer. */
          <StatusPill tone="success">{s.allMapped}</StatusPill>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Room Types stream — inventory + open/close */}
        <Card>
          <CardHeader title={s.roomsTitle(channel.name)} action={<span className="text-[11px] text-ink-400">{s.roomsNote}</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {[s.cols.room, s.cols.externalRoom, s.cols.status].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {roomTypeMappings.map((m) => (
                  <tr key={m.productId} id={`map-room-${m.productId}`} className="group border-b border-surface-border/60 transition-colors last:border-0 target:bg-warning-50 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-semibold text-ink-900">{m.roomType.name}</td>
                    <td className="tnum px-4 py-2.5 text-ink-500">{m.externalRoomId ?? <span className="text-danger-500">—</span>}</td>
                    <td className="px-4 py-2.5"><StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{statusLabel(m.status)}</StatusPill></td>
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
          <CardHeader title={s.ratesTitle(channel.name)} action={<span className="text-[11px] text-ink-400">{s.ratesNote}</span>} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-surface-border text-left text-[11px] uppercase tracking-wide text-ink-400">
                  {[s.cols.plan, s.cols.externalRate, s.cols.status].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
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
                            {s.toConfirm(rows.filter((r) => r.unmapped).length)}
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
                              {s.currentlyPublishing(m.inheritedExternalId.slice(0, 8))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill tone={STATUS_TONE[m.status] ?? "neutral"}>{statusLabel(m.status)}</StatusPill>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                            <MappingEditDialog
                              kind="rate" id={m.id} productId={m.productId}
                              label={`${m.roomTypeName} · ${m.ratePlan.name}`}
                              externalId={m.externalRateId}
                              channelName={channel.name} channelId={channel.id}
                              roomTypeId={m.roomTypeId}
                              options={ratesForRoom(m.roomTypeId)}
                              optionsNote={
                                !scopesByRoom
                                  ? undefined
                                  : !channexRoomOf.has(m.roomTypeId)
                                    ? s.notes.roomFirst(m.roomTypeName, channel.name)
                                    : ratesForRoom(m.roomTypeId).length === 0
                                      ? s.notes.noPlans(channel.name, m.roomTypeName)
                                      : excluded.length > 0
                                        ? s.notes.excluded(channel.name, m.roomTypeName, excluded.length)
                                        : undefined
                              }
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
