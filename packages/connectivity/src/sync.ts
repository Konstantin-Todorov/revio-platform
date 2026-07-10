/**
 * Shared connectivity orchestration — the real `edit → derive → push` and `pull` loops, extracted from
 * the Channel Manager app so **every** product (CM, CRS, PMS) can trigger them. Each function takes a
 * tenant-scoped Prisma client (the app's RLS proxy) so it writes under the caller's tenant perimeter.
 *
 * The single rule this preserves: there is ONE availability truth in the shared DB. Any app that changes
 * inventory (a CRS booking, a PMS OOO / walk-in / check-in) can now call `syncRealChannels(db, propertyId)`
 * and the change reaches Channex immediately — no manual Re-sync in the CM.
 */
import { forSystem, decryptSecret, forTenant } from "@revio/db";
import {
  channelSupports, computeWaterfall, deriveRate, expandInventoryPeriods, isAdvancePurchaseClosed,
  resolveRestriction, SOLD_STATUSES, type AriUpdate, type DerivedRateConfig, type RestrictionRuleHit,
  type RestrictionType,
} from "@revio/core";
import { createChannelAdapter, type AdapterMode } from "./factory.js";

/** The tenant-scoped Prisma proxy each app already builds (`@revio/db` `forTenant`). */
type Db = ReturnType<typeof forTenant>;

/** How many days of ARI a push covers. */
const HORIZON_DAYS = 14;
const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Map our stored connectivityMode to the @revio/connectivity factory mode. */
function adapterMode(mode: string): AdapterMode {
  if (mode === "channex_sandbox") return "channex-sandbox";
  if (mode === "channex_prod") return "channex-prod";
  return "mock";
}

/**
 * Resolve the Channex key for a tenant + mode: the operator-managed ENCRYPTED per-tenant credential
 * first, env as fallback. Read via the system perimeter (the credential table is RLS bypass-only so
 * hotels can never query it) — the plaintext never leaves the server.
 */
async function channexKey(tenantId: string, mode: string): Promise<string> {
  const cred = await forSystem().connectivityCredential.findUnique({
    where: { tenantId_mode: { tenantId, mode } },
  });
  if (cred) {
    try {
      return decryptSecret(cred.cipher);
    } catch {
      // Wrong CONNECTIVITY_SECRET or corrupted payload — fall through to env so a misconfigured
      // credential degrades to the old behaviour instead of silently pushing unauthenticated.
    }
  }
  return (mode === "channex_prod" ? process.env.CHANNEX_PROD_KEY : process.env.CHANNEX_SANDBOX_KEY) ?? "";
}

export interface SyncOutcome {
  ok: boolean;
  pushed: number;
  rejected: number;
  mode: string;
  error?: string;
}

/**
 * Build the next HORIZON_DAYS of ARI for a channel from its two-stream mappings + the live inventory/
 * rates/restrictions, and push it through the resolved adapter (mock or Channex). Records a SyncEvent
 * and an ErrorItem per rejected update.
 */
export async function syncChannel(prisma: Db, channelId: string, opts?: { horizonDays?: number }): Promise<SyncOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, include: { bookingSource: true } });
  if (!channel) return { ok: false, pushed: 0, rejected: 0, mode: "mock", error: "Unknown channel." };
  // A paused/disconnected channel must NOT receive normal ARI — Resume/Reconnect restore it
  // deliberately (spec §3.5: pause is a stop-sell overlay; a stray sync would undo it).
  if (channel.status === "paused" || channel.status === "disconnected") {
    return { ok: false, pushed: 0, rejected: 0, mode: channel.connectivityMode, error: `Channel is ${channel.status}.` };
  }
  const horizonDays = Math.min(500, Math.max(1, opts?.horizonDays ?? HORIZON_DAYS));
  const property = await prisma.property.findUniqueOrThrow({ where: { id: channel.propertyId } });
  const { tenantId, propertyId } = channel;

  // Complete mappings only (a product is sendable when its room type AND rate plan are mapped).
  const [roomMaps, rateMaps] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId, status: "complete", externalRoomId: { not: null } }, include: { roomType: true } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId, status: "complete", externalRateId: { not: null } }, include: { ratePlan: true } }),
  ]);

  const start = new Date(`${ymd(new Date())}T00:00:00Z`);
  const end = new Date(start.getTime() + (horizonDays - 1) * DAY_MS);
  const dates = Array.from({ length: horizonDays }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  const todayStr = ymd(start);

  const roomTypeIds = roomMaps.map((m) => m.roomTypeId);

  const [cells, prices, resLines, periods, holds, propertyDefaults] = await Promise.all([
    prisma.dailyCell.findMany({ where: { roomTypeId: { in: roomTypeIds }, date: { gte: start, lte: end } } }),
    prisma.ratePrice.findMany({ where: { propertyId, date: { gte: start, lte: end } } }),
    prisma.reservationLine.findMany({
      where: { roomTypeId: { in: roomTypeIds }, reservation: { propertyId, status: { in: [...SOLD_STATUSES] } } },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    }),
    prisma.roomInventoryPeriod.findMany({ where: { roomTypeId: { in: roomTypeIds }, dateFrom: { lte: end }, dateTo: { gte: start } } }),
    prisma.hold.findMany({
      where: { roomTypeId: { in: roomTypeIds }, status: "active", expiresAt: { gt: new Date() }, checkIn: { lte: end }, checkOut: { gt: start } },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    }),
    prisma.propertyDefaults.findUnique({ where: { propertyId } }),
  ]);
  // Standing restriction rules overlapping the window — they sit between a date-scoped cell edit
  // and the rate-plan/property defaults in the two-tier resolution (see @revio/core resolve.ts).
  const rules = await prisma.restrictionRule.findMany({
    where: { propertyId, active: true, dateFrom: { lte: end }, dateTo: { gte: start } },
  });
  const srcCategory = channel.bookingSource?.category ?? null;
  const ruleHits = (type: string, rtId: string, rpId: string, k: string): RestrictionRuleHit[] =>
    rules
      .filter((r) =>
        r.type === type &&
        (r.roomTypeId == null || r.roomTypeId === rtId) &&
        (r.ratePlanId == null || r.ratePlanId === rpId) &&
        (r.channelCodes.length === 0 || r.channelCodes.includes(channel.code)) &&
        (r.sourceCategories.length === 0 || (srcCategory != null && r.sourceCategories.includes(srcCategory))) &&
        ymd(r.dateFrom) <= k && ymd(r.dateTo) >= k,
      )
      .map((r) => ({ priority: r.priority, value: (r.valueBool ?? r.valueInt ?? true) as number | boolean }));

  const cellKey = (rt: string, k: string) => `${rt}:${k}`;
  const cellMap = new Map(cells.map((c) => [cellKey(c.roomTypeId, ymd(c.date)), c]));
  const priceMap = new Map(prices.map((p) => [`${p.roomTypeId}:${p.ratePlanId}:${ymd(p.date)}`, p.priceMinor]));

  function priceFor(roomTypeId: string, rp: (typeof rateMaps)[number]["ratePlan"], k: string): number | null {
    const direct = priceMap.get(`${roomTypeId}:${rp.id}:${k}`);
    if (direct != null) return direct;
    if (rp.priceLogic === "derived" && rp.parentRatePlanId) {
      const parent = priceMap.get(`${roomTypeId}:${rp.parentRatePlanId}:${k}`);
      if (parent == null) return null;
      const cfg: DerivedRateConfig = {
        parentRatePlanId: rp.parentRatePlanId,
        adjustmentType: (rp.derivedType as "percent" | "fixed") ?? "percent",
        direction: (rp.derivedDirection as "increase" | "decrease") ?? "decrease",
        value: rp.derivedValue ?? 0,
        rounding: (rp.derivedRounding as DerivedRateConfig["rounding"]) ?? "none",
        ...(rp.derivedFloorMinor != null ? { floorMinor: rp.derivedFloorMinor } : {}),
        ...(rp.derivedCeilingMinor != null ? { ceilingMinor: rp.derivedCeilingMinor } : {}),
      };
      return deriveRate(parent, cfg);
    }
    return null;
  }

  const updates: AriUpdate[] = [];
  const dateKeys = dates.map(ymd);
  for (const rm of roomMaps) {
    const rt = rm.roomType;
    const periodByDate = expandInventoryPeriods(
      periods.filter((p) => p.roomTypeId === rt.id).map((p) => ({ kind: p.kind, dateFrom: ymd(p.dateFrom), dateTo: ymd(p.dateTo), rooms: p.rooms })),
      dateKeys,
    );
    for (const d of dates) {
      const k = ymd(d);
      const cell = cellMap.get(cellKey(rt.id, k));
      const sold = resLines.filter((l) => l.roomTypeId === rt.id && l.checkIn <= d && d < l.checkOut).reduce((s, l) => s + l.quantity, 0);
      const held = holds.filter((h) => h.roomTypeId === rt.id && h.checkIn <= d && d < h.checkOut).reduce((s, h) => s + h.quantity, 0);
      const { outOfOrder, closed } = periodByDate.get(k)!;
      const bookable = Math.max(0, computeWaterfall({
        physical: rt.totalRooms, outOfOrder, closed,
        manualSellLimit: cell?.inventory ?? null,
        holds: held, confirmed: sold,
      }).remaining);

      for (const pm of rateMaps) {
        const rp = pm.ratePlan;
        const price = priceFor(rt.id, rp, k);
        if (price == null) continue;

        // Two-tier resolution per (room type, rate plan, date): date-scoped cell → rule →
        // rate-plan default → property default. Flags treat false as "unset" at every tier.
        const flagOf = (type: RestrictionType, cellV: boolean | undefined, planV: boolean, propV: boolean | undefined) =>
          Boolean(resolveRestriction(type, {
            ...(cellV ? { dateScoped: true } : {}),
            matchingRules: ruleHits(type, rt.id, rp.id, k),
            ...(planV ? { ratePlanDefault: true } : {}),
            ...(propV ? { propertyDefault: true } : {}),
          }).value);
        const numOf = (type: RestrictionType, cellV: number | null | undefined, planV: number | null, propV: number | null | undefined) => {
          const r = resolveRestriction(type, {
            ...(cellV != null ? { dateScoped: cellV } : {}),
            matchingRules: ruleHits(type, rt.id, rp.id, k),
            ...(planV != null ? { ratePlanDefault: planV } : {}),
            ...(propV != null ? { propertyDefault: propV } : {}),
          });
          return r.source === "none" ? null : Number(r.value);
        };

        // Capability map (spec §5.2): never send this channel a restriction type it can't
        // honour — a limitation is not a failure, so it must never become a rejected update.
        const can = (type: RestrictionType) => channelSupports(channel.supportedRestrictions, type);
        const apMin = can("advance_purchase_min")
          ? numOf("advance_purchase_min", cell?.advancePurchaseMin, rp.defAdvancePurchaseMin, propertyDefaults?.defAdvancePurchaseMin)
          : null;
        const apMax = can("advance_purchase_max")
          ? numOf("advance_purchase_max", cell?.advancePurchaseMax, rp.defAdvancePurchaseMax, propertyDefaults?.defAdvancePurchaseMax)
          : null;
        const apClosed = isAdvancePurchaseClosed(todayStr, k, { min: apMin, max: apMax });
        const stopSell = flagOf("stop_sell", cell?.stopSell, rp.defStopSell, propertyDefaults?.defStopSell) || apClosed;
        const restrictions: AriUpdate["restrictions"] = { stopSell };
        if (can("cta")) restrictions.cta = flagOf("cta", cell?.cta, rp.defCta, propertyDefaults?.defCta);
        if (can("ctd")) restrictions.ctd = flagOf("ctd", cell?.ctd, rp.defCtd, propertyDefaults?.defCtd);
        const minLos = can("min_los") ? numOf("min_los", cell?.minLos, rp.defMinLos, propertyDefaults?.defMinLos) : null;
        const maxLos = can("max_los") ? numOf("max_los", cell?.maxLos, rp.defMaxLos, propertyDefaults?.defMaxLos) : null;
        if (minLos != null) restrictions.minLos = minLos;
        if (maxLos != null) restrictions.maxLos = maxLos;
        if (apMin != null) restrictions.advancePurchaseMin = apMin;
        if (apMax != null) restrictions.advancePurchaseMax = apMax;

        updates.push({
          externalRoomId: rm.externalRoomId!,
          externalRateId: pm.externalRateId!,
          date: k,
          bookable: stopSell ? 0 : bookable,
          priceMinor: price,
          currency: property.baseCurrency,
          restrictions,
        });
      }
    }
  }

  const mode = adapterMode(channel.connectivityMode);
  const adapter = createChannelAdapter({
    mode,
    channelCode: channel.code,
    ...(mode !== "mock"
      ? { channex: { apiKey: await channexKey(tenantId, channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
      : {}),
  });

  const result = await adapter.pushAri(updates);

  await prisma.syncEvent.create({
    data: {
      tenantId, propertyId, channelId, kind: "push", status: result.ok ? "success" : "failed",
      summary: `Pushed ${updates.length - result.rejected.length}/${updates.length} updates to ${channel.name} (${channel.connectivityMode})`,
      detail: result.channelResponseId ?? null,
    },
  });
  for (const r of result.rejected.slice(0, 25)) {
    await prisma.errorItem.create({
      data: {
        tenantId, propertyId, channelId, severity: "warning", code: "update_rejected",
        message: r.reason, productLabel: `${channel.name} · ${r.update.date}`,
        recommendedAction: "Check the channel mapping / supported restrictions.", resolved: false,
      },
    });
  }
  await prisma.channel.update({
    where: { id: channelId },
    data: { lastSyncAt: new Date(), pendingCount: 0, errorCount: result.rejected.length },
  });

  return { ok: result.ok, pushed: updates.length - result.rejected.length, rejected: result.rejected.length, mode: channel.connectivityMode };
}

/**
 * Auto-push: sync every connected channel of the property that uses a REAL adapter (non-mock).
 * Called after ARI-affecting edits — in ANY product — so channex-mode channels receive the change
 * without a manual Re-sync. A no-op when every channel is mock (the default), so demo flows are safe.
 */
export async function syncRealChannels(prisma: Db, propertyId: string): Promise<void> {
  const real = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: { not: "mock" } },
    select: { id: true },
  });
  for (const c of real) {
    try {
      await syncChannel(prisma, c.id);
    } catch {
      // syncChannel records its own SyncEvent/ErrorItems; never block the caller's write on a push failure.
    }
  }
}

// --- Pull: bookings back from the channel -----------------------------------

export interface PullOutcome {
  ok: boolean;
  imported: number;
  updated: number;
  unchanged: number;
  mode: string;
  error?: string;
}

const PULL_LOOKBACK_DAYS = 7;

/**
 * Pull bookings from the channel's adapter and import them: new bookings become Reservations
 * (availability self-corrects because "sold" is derived from confirmed reservations), status changes
 * update in place, and bookings that can't be mapped land as failed_import + an Error Center item.
 */
export async function pullChannel(prisma: Db, channelId: string): Promise<PullOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, imported: 0, updated: 0, unchanged: 0, mode: "mock", error: "Unknown channel." };
  const property = await prisma.property.findUniqueOrThrow({ where: { id: channel.propertyId } });
  const { tenantId, propertyId } = channel;

  const [roomMaps, rateMaps] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId, externalRoomId: { not: null } }, include: { roomType: true } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId, externalRateId: { not: null } } }),
  ]);
  const roomByExternal = new Map(roomMaps.map((m) => [m.externalRoomId!, m]));
  const rateByExternal = new Map(rateMaps.map((m) => [m.externalRateId!, m.ratePlanId]));

  const mode = adapterMode(channel.connectivityMode);
  const adapter = createChannelAdapter({
    mode,
    channelCode: channel.code,
    ...(mode !== "mock"
      ? { channex: { apiKey: await channexKey(tenantId, channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
      : {}),
  });

  const useFeed = typeof adapter.pullRevisions === "function" && typeof adapter.acknowledgeBooking === "function";
  const since = new Date(Date.now() - PULL_LOOKBACK_DAYS * DAY_MS).toISOString();
  let raws;
  const ackIds: string[] = [];
  try {
    if (useFeed) {
      const revisions = await adapter.pullRevisions!();
      raws = revisions.map((r) => r.reservation);
      for (const r of revisions) ackIds.push(r.revisionId);
    } else {
      raws = await adapter.pullReservations(since);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pull failed";
    await prisma.syncEvent.create({
      data: { tenantId, propertyId, channelId, kind: "pull", status: "failed", summary: `Pull from ${channel.name} failed`, detail: message },
    });
    return { ok: false, imported: 0, updated: 0, unchanged: 0, mode: channel.connectivityMode, error: message };
  }

  let imported = 0;
  let updated = 0;
  let unchanged = 0;

  for (const raw of raws) {
    const existing = await prisma.reservation.findFirst({ where: { channelId, externalId: raw.externalId } });
    const status = raw.status === "cancelled" ? "cancelled" : raw.status === "modified" ? "modified" : "confirmed";

    if (existing) {
      if (existing.status !== status && existing.status !== "cancelled") {
        await prisma.reservation.update({ where: { id: existing.id }, data: { status } });
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    const lines: { roomTypeId: string; ratePlanId: string; quantity: number; checkIn: Date; checkOut: Date }[] = [];
    let unmapped = false;
    for (const l of raw.lines) {
      const room = roomByExternal.get(l.externalRoomId);
      const ratePlanId = rateByExternal.get(l.externalRateId);
      if (!room || !ratePlanId) {
        unmapped = true;
        continue;
      }
      lines.push({
        roomTypeId: room.roomTypeId,
        ratePlanId,
        quantity: l.quantity,
        checkIn: new Date(`${l.checkIn}T00:00:00Z`),
        checkOut: new Date(`${l.checkOut}T00:00:00Z`),
      });
    }

    const sameCurrency = raw.currency === property.baseCurrency;
    const fx = {
      propertyCurrency: property.baseCurrency,
      propertyTotalMinor: sameCurrency ? raw.totalMinor : null,
      fxRate: sameCurrency ? 1 : null,
      fxAt: new Date(),
    };

    if (unmapped || lines.length === 0) {
      await prisma.reservation.create({
        data: { tenantId, propertyId, channelId, externalId: raw.externalId, guestName: raw.guestName, status: "failed_import", totalMinor: raw.totalMinor, currency: raw.currency, ...fx },
      });
      await prisma.errorItem.create({
        data: {
          tenantId, propertyId, channelId, severity: "critical", code: "reservation_unmapped",
          message: `Booking #${raw.externalId} references an unmapped room or rate`,
          productLabel: `${channel.name} · ${raw.guestName}`,
          recommendedAction: "Complete the room/rate mapping for this channel, then pull again.", resolved: false,
        },
      });
      imported++;
      continue;
    }

    let overbooked = false;
    for (const line of lines) {
      const room = roomMaps.find((m) => m.roomTypeId === line.roomTypeId);
      for (let t = line.checkIn.getTime(); t < line.checkOut.getTime(); t += DAY_MS) {
        const d = new Date(t);
        const [cell, soldAgg, heldAgg, dayPeriods] = await Promise.all([
          prisma.dailyCell.findUnique({ where: { roomTypeId_date: { roomTypeId: line.roomTypeId, date: d } } }),
          prisma.reservationLine.aggregate({
            _sum: { quantity: true },
            where: { roomTypeId: line.roomTypeId, checkIn: { lte: d }, checkOut: { gt: d }, reservation: { status: { in: [...SOLD_STATUSES] } } },
          }),
          prisma.hold.aggregate({
            _sum: { quantity: true },
            where: { roomTypeId: line.roomTypeId, status: "active", expiresAt: { gt: new Date() }, checkIn: { lte: d }, checkOut: { gt: d } },
          }),
          prisma.roomInventoryPeriod.findMany({ where: { roomTypeId: line.roomTypeId, dateFrom: { lte: d }, dateTo: { gte: d } } }),
        ]);
        const remaining = computeWaterfall({
          physical: room?.roomType.totalRooms ?? 0,
          outOfOrder: dayPeriods.filter((p) => p.kind === "out_of_order").reduce((s, p) => s + p.rooms, 0),
          closed: dayPeriods.filter((p) => p.kind === "closure").reduce((s, p) => s + p.rooms, 0),
          manualSellLimit: cell?.inventory ?? null,
          holds: heldAgg._sum.quantity ?? 0,
          confirmed: soldAgg._sum.quantity ?? 0,
        }).remaining;
        if (remaining - line.quantity < 0) overbooked = true;
      }
    }

    await prisma.reservation.create({
      data: {
        tenantId, propertyId, channelId, externalId: raw.externalId, guestName: raw.guestName,
        status: overbooked ? "overbooked" : status, totalMinor: raw.totalMinor, currency: raw.currency, ...fx,
        lines: { create: lines },
      },
    });
    if (overbooked) {
      await prisma.errorItem.create({
        data: {
          tenantId, propertyId, channelId, severity: "critical", code: "overbooking_detected",
          message: `Overbooking: booking #${raw.externalId} exceeds available rooms`,
          productLabel: `${channel.name} · ${raw.guestName}`,
          recommendedAction: "Resolve manually with the guest or move the booking.", resolved: false,
        },
      });
    }
    imported++;
  }

  for (const revisionId of ackIds) {
    try {
      await adapter.acknowledgeBooking!(revisionId);
    } catch {
      /* a failed ack just means Channex re-sends it next pull — safe (idempotent). */
    }
  }

  await prisma.syncEvent.create({
    data: {
      tenantId, propertyId, channelId, kind: "pull", status: "success",
      summary: `Pulled ${raws.length} ${useFeed ? "revisions" : "bookings"} from ${channel.name} (${imported} new · ${updated} updated · ${unchanged} unchanged)`,
    },
  });
  await prisma.channel.update({ where: { id: channelId }, data: { lastSyncAt: new Date() } });

  if (imported > 0 || updated > 0) await syncRealChannels(prisma, propertyId);

  return { ok: true, imported, updated, unchanged, mode: channel.connectivityMode };
}


// --- Channel quick actions (spec CM-GUIDE-V2 §3.5) --------------------------------------------

export interface ChannelActionOutcome {
  ok: boolean;
  error?: string;
}

/** Build a full-horizon STOP-SELL overlay for one channel (used by pause + disconnect close-out).
 * Never touches the core's ARI — availability and rates stay intact, so Resume can restore the
 * exact prior state just by re-pushing the truth. */
async function pushStopSellOverlay(prisma: Db, channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.connectivityMode === "mock") return; // mock channels: the flag alone suffices
  const [roomMaps, rateMaps] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId, status: "complete", externalRoomId: { not: null } } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId, status: "complete", externalRateId: { not: null } } }),
  ]);
  const start = new Date(`${ymd(new Date())}T00:00:00Z`);
  const updates: AriUpdate[] = [];
  for (let i = 0; i < 365; i++) {
    const k = ymd(new Date(start.getTime() + i * DAY_MS));
    for (const rm of roomMaps) {
      for (const pm of rateMaps) {
        updates.push({
          externalRoomId: rm.externalRoomId!, externalRateId: pm.externalRateId!, date: k,
          bookable: 0, priceMinor: 0, currency: "EUR", restrictions: { stopSell: true },
        });
      }
    }
  }
  if (updates.length === 0) return;
  const mode = adapterMode(channel.connectivityMode);
  const adapter = createChannelAdapter({
    mode,
    channelCode: channel.code,
    ...(mode !== "mock"
      ? { channex: { apiKey: await channexKey(channel.tenantId, channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
      : {}),
  });
  await adapter.pushAri(updates);
}

/** Pause: reversible stop-sell overlay on THIS channel only — other channels keep selling from the
 * shared pool; the core's ARI is never zeroed (there would be nothing to restore). */
export async function pauseChannel(prisma: Db, channelId: string): Promise<ChannelActionOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, error: "Unknown channel." };
  if (channel.status !== "connected") return { ok: false, error: "Only a connected channel can be paused." };
  await pushStopSellOverlay(prisma, channelId);
  await prisma.channel.update({ where: { id: channelId }, data: { status: "paused" } });
  await prisma.syncEvent.create({
    data: {
      tenantId: channel.tenantId, propertyId: channel.propertyId, channelId, kind: "push", status: "success",
      summary: `Channel paused — all dates closed on ${channel.name} (stop-sell overlay, reversible)`,
    },
  });
  return { ok: true };
}

/** Resume: restore the exact prior state by re-pushing the core's truth (365 days). */
export async function resumeChannel(prisma: Db, channelId: string): Promise<ChannelActionOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, error: "Unknown channel." };
  if (channel.status !== "paused") return { ok: false, error: "Channel is not paused." };
  await prisma.channel.update({ where: { id: channelId }, data: { status: "connected" } });
  const outcome = await syncChannel(prisma, channelId, { horizonDays: 365 });
  await prisma.syncEvent.create({
    data: {
      tenantId: channel.tenantId, propertyId: channel.propertyId, channelId, kind: "push", status: outcome.ok ? "success" : "failed",
      summary: `Channel resumed — ${channel.name} restored from the shared ARI (${outcome.pushed} updates)`,
    },
  });
  return { ok: outcome.ok, ...(outcome.error ? { error: outcome.error } : {}) };
}

/** Disconnect: stop syncing and close the channel out so it isn't left selling on stale rates.
 * Mappings are PRESERVED dormant (a later reconnect never forces a remap); reservations already
 * imported from this channel are never touched. */
export async function disconnectChannel(prisma: Db, channelId: string): Promise<ChannelActionOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, error: "Unknown channel." };
  if (channel.status === "disconnected") return { ok: false, error: "Already disconnected." };
  await pushStopSellOverlay(prisma, channelId);
  await prisma.channel.update({ where: { id: channelId }, data: { status: "disconnected" } });
  await prisma.syncEvent.create({
    data: {
      tenantId: channel.tenantId, propertyId: channel.propertyId, channelId, kind: "push", status: "success",
      summary: `Channel disconnected — ${channel.name} closed out; mapping kept dormant for a later reconnect`,
    },
  });
  return { ok: true };
}

/** Reconnect a dormant channel: mappings were preserved, so one full sync restores distribution. */
export async function reconnectChannel(prisma: Db, channelId: string): Promise<ChannelActionOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, error: "Unknown channel." };
  if (channel.status !== "disconnected") return { ok: false, error: "Channel is not disconnected." };
  await prisma.channel.update({ where: { id: channelId }, data: { status: "connected" } });
  const outcome = await syncChannel(prisma, channelId, { horizonDays: 365 });
  await prisma.syncEvent.create({
    data: {
      tenantId: channel.tenantId, propertyId: channel.propertyId, channelId, kind: "push", status: outcome.ok ? "success" : "failed",
      summary: `Channel reconnected — ${channel.name} resumed distribution (${outcome.pushed} updates, dormant mapping reused)`,
    },
  });
  return { ok: outcome.ok, ...(outcome.error ? { error: outcome.error } : {}) };
}


/** Pull the channel's own products (rooms + rates with their OTA-side ids) for dropdown mapping.
 * Returns empty lists when the adapter can't list (network trouble must never break the screen). */
export async function listChannelProducts(
  prisma: Db, channelId: string,
): Promise<{ rooms: { id: string; name: string }[]; rates: { id: string; name: string }[] }> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { rooms: [], rates: [] };
  try {
    const mode = adapterMode(channel.connectivityMode);
    const adapter = createChannelAdapter({
      mode,
      channelCode: channel.code,
      ...(mode !== "mock"
        ? { channex: { apiKey: await channexKey(channel.tenantId, channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
        : {}),
    });
    return (await adapter.listProducts?.()) ?? { rooms: [], rates: [] };
  } catch {
    return { rooms: [], rates: [] };
  }
}
