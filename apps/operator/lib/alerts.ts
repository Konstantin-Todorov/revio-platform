import "server-only";
import { forSystem } from "@revio/db";
import { crossWiredFromRecord, type AlertCandidate } from "@revio/core";

/**
 * Everything across the portfolio that a person should be told about, in one list.
 *
 * ## ⚠️ Read from facts, never from the Error Center
 *
 * Every candidate here is derived from something a customer cannot switch off. A hotel can mark an
 * Error Center entry resolved — which dismisses the reminder and repairs nothing — and that is
 * exactly what buried a real client's booking for two days. An alert sourced from a dismissible row
 * is an alert that stops arriving precisely when somebody has decided not to deal with the problem.
 *
 * ## What is NOT in here
 *
 * Anything commercial. Renewals, unpaid invoices, quiet accounts and expansion candidates all
 * belong to the console's "Our accounts" half — they are a morning's work, not an interruption. This
 * mail is only for "somebody's hotel is not doing its job", which is the half with a guest at the
 * other end of it.
 */

const prisma = forSystem();

export async function alertCandidates(): Promise<AlertCandidate[]> {
  const out: AlertCandidate[] = [];

  /*
   * 1. A booking a channel confirmed to a guest that we hold no stay for.
   *
   * Counted from the RESERVATIONS, for the reason in the header. The most consequential thing on
   * this list: somebody may arrive at a desk with no record of them, and the room is still on sale.
   */
  const failed = await prisma.reservation.groupBy({
    by: ["tenantId"],
    where: { status: "failed_import" },
    _count: true,
    _min: { importedAt: true },
  });
  const tenantNames = new Map(
    (await prisma.tenant.findMany({ select: { id: true, name: true } })).map((t) => [t.id, t.name]),
  );
  for (const f of failed) {
    const n = f._count;
    out.push({
      // Keyed on the tenant, not on each booking: "2 bookings did not import" is one problem.
      key: `failed_import:${f.tenantId}`,
      clientName: tenantNames.get(f.tenantId) ?? "Unknown client",
      summary: n === 1 ? "A booking never reached the calendar" : `${n} bookings never reached the calendar`,
      action:
        "Finish the mapping, then press Re-import bookings on their Channels screen. " +
        "Re-sync only sends prices out and cannot bring a booking back.",
      severity: "act",
    });
  }

  /*
   * 2. A channel pointed at a property the channel no longer has.
   *
   * Written by the nightly audit. It reports `success` on every poll, because a filter on an id that
   * does not exist is not an error — which is why nothing noticed for weeks.
   */
  const missing = await prisma.channel.findMany({
    /*
     * ⚠️ A DISCONNECTED channel is excluded, and the summary below is why.
     *
     * It reads "is connected to a property the channel has deleted". Once the channel is
     * disconnected that sentence is false in its first word, and there is nothing left to act on:
     * nothing syncs, nothing is billed, and the dead property id is kept only so a later reconnect
     * has something to replace. Ventsi Group's sat here after being disconnected on 2026-09-22 —
     * an `act` alert whose only remaining action was the one already taken, which is exactly how a
     * feed stops being read.
     *
     * The alert still returns by itself if somebody reconnects: the mapping audit selects on
     * `status: "connected"`, so a reconnected channel is walked again on the next run and
     * `catalogueStatus` is rewritten from what Channex actually answers. While it is disconnected
     * that field is frozen at its last reading, which is correct — it is a record of what was true
     * when we last asked, not a claim about now.
     */
    where: { catalogueStatus: "property_missing", status: { not: "disconnected" } },
    select: { id: true, name: true, property: { select: { name: true, tenant: { select: { name: true } } } } },
  });
  for (const ch of missing) {
    out.push({
      key: `property_missing:${ch.id}`,
      clientName: ch.property.tenant.name,
      summary: `${ch.property.name} · ${ch.name} is connected to a property the channel has deleted`,
      action: "Nothing sent is arriving and nothing can arrive back. Reconnect the channel so it is set up again.",
      severity: "act",
    });
  }

  /*
   * 3. A rate plan publishing to the wrong room.
   *
   * No other symptom exists: the mapping reads `mapped`, every push succeeds, and one room's prices
   * go onto another. Compared against what the channel itself said, recorded nightly.
   */
  const rateMaps = await prisma.channelRatePlanMapping.findMany({
    // A disconnected channel publishes nothing — same rule as the property_missing alert above.
    where: { catalogueCheckedAt: { not: null }, externalRateId: { not: null }, roomTypeId: { not: null }, channel: { status: { not: "disconnected" } } },
    select: {
      channelId: true, roomTypeId: true, externalRateId: true, externalRoomIdSeen: true, catalogueCheckedAt: true,
      ratePlan: { select: { name: true, active: true } }, roomType: { select: { name: true } },
      channel: { select: { name: true, property: { select: { name: true, tenant: { select: { name: true } } } } } },
    },
  });
  const roomMaps = await prisma.channelRoomTypeMapping.findMany({
    where: { externalRoomId: { not: null } },
    select: { channelId: true, roomTypeId: true, externalRoomId: true },
  });
  // ⚠️ Grouped by channel before comparing: a room's external id is per channel, so comparing across
  // them would invent a mismatch on every client with two channels connected.
  const channels = new Set(rateMaps.map((m) => m.channelId));
  for (const channelId of channels) {
    const rows = rateMaps.filter((m) => m.channelId === channelId);
    const ourRooms = new Map(
      roomMaps.flatMap((r) => (r.channelId === channelId && r.externalRoomId ? [[r.roomTypeId, r.externalRoomId] as const] : [])),
    );
    const faults = crossWiredFromRecord(
      rows.map((m) => ({
        roomTypeId: m.roomTypeId!,
        roomTypeName: m.roomType?.name ?? "",
        ratePlanName: m.ratePlan.name,
        externalRateId: m.externalRateId,
        externalRoomIdSeen: m.externalRoomIdSeen,
        checkedAt: m.catalogueCheckedAt,
        active: m.ratePlan.active,
      })),
      ourRooms,
    );
    const ctx = rows[0]!.channel;
    for (const f of faults) {
      out.push({
        key: `cross_wired:${channelId}:${f.roomTypeName}|${f.ratePlanName}`,
        clientName: ctx.property.tenant.name,
        summary: `${f.roomTypeName} · ${f.ratePlanName} is publishing to the wrong room on ${ctx.name}`,
        action: "Open Mapping and pick the rate plan the channel lists under that room. The prices are going onto another room until it changes.",
        severity: "act",
      });
    }
  }

  /*
   * 4. Pushes the CHANNEL recorded as failed, in its own task log.
   *
   * ⚠️ The destination's verdict rather than ours. `SyncEvent` says what we sent; this says what
   * they did with it, and two independent records disagreeing is the only way that class of fault
   * becomes visible. Written nightly by the audit.
   */
  const pushFailing = await prisma.channel.findMany({
    where: { pushFailures: { gt: 0 } },
    select: { id: true, name: true, pushFailures: true, property: { select: { name: true, tenant: { select: { name: true } } } } },
  });
  for (const ch of pushFailing) {
    const n = ch.pushFailures;
    out.push({
      key: `push_failed:${ch.id}`,
      clientName: ch.property.tenant.name,
      summary:
        `${ch.name} rejected ${n} change${n === 1 ? "" : "s"} we sent for ${ch.property.name} in the last week`,
      action:
        "Our own sync log reports these as sent. The channel's record says they did not take — so " +
        "prices or availability there are not what this system thinks. Open the Error Center for the reason.",
      severity: "act",
    });
  }

  /*
   * 5. A mapping that belongs to a rate plan the hotel has switched OFF.
   *
   * ⚠️ The push now skips these, so nothing is being published — but the row is still there, still
   * says `complete`, and is still wrong. It is how the 2-Bedroom came to publish against the
   * 1-Bedroom: a plan nobody maintains, mapped years ago, that kept going. Reported so it gets
   * cleared rather than waiting to be re-enabled and start pushing nonsense again.
   *
   * `soon`, not `act`: it is no longer doing damage. It is a thing to tidy before it can.
   */
  const staleMaps = await prisma.channelRatePlanMapping.findMany({
    where: { externalRateId: { not: null }, ratePlan: { active: false }, channel: { status: { not: "disconnected" } } },
    select: {
      channelId: true, ratePlan: { select: { name: true, active: true } }, roomType: { select: { name: true } },
      channel: { select: { name: true, property: { select: { name: true, tenant: { select: { name: true } } } } } },
    },
  });
  // One line per client+plan: five rooms carrying the same dead plan is one thing to tidy, not five.
  const byPlan = new Map<string, { clientName: string; channel: string; plan: string; rooms: string[] }>();
  for (const m of staleMaps) {
    const k = `${m.channelId}:${m.ratePlan.name}`;
    const e = byPlan.get(k) ?? {
      clientName: m.channel.property.tenant.name,
      channel: m.channel.name,
      plan: m.ratePlan.name,
      rooms: [],
    };
    if (m.roomType?.name) e.rooms.push(m.roomType.name);
    byPlan.set(k, e);
  }
  for (const [k, e] of byPlan) {
    out.push({
      key: `stale_mapping:${k}`,
      clientName: e.clientName,
      summary: `"${e.plan}" is switched off but still mapped on ${e.channel}`,
      /*
       * ⚠️ This sentence was wrong for a day, and the correction matters because it was emailed.
       *
       * On 2026-09-22 it said a pause "closes the wrong room" through a stale mapping. It does not:
       * a pause closes EVERY mapped room, so there is no wrong one, and a resume re-opens only
       * switched-on plans, so a switched-off plan correctly stays closed. A warning that makes an
       * operator hesitate to press Pause during an incident is worse than no warning. What is true
       * is below — two consequences, both about the plan being switched on again or left as is.
       */
      action:
        `Nothing goes out for it — the push skips switched-off plans — so whatever the channel last ` +
        `received for it is frozen there. If the channel still offers that rate, it offers it at that ` +
        `last price. And if the plan is ever switched back on, it starts publishing to whatever this ` +
        `mapping points at, which nobody has checked since it was switched off. Clear it on the ` +
        `Mapping screen` + (e.rooms.length ? ` (${e.rooms.join(", ")}).` : "."),
      severity: "soon",
    });
  }

  return out;
}
