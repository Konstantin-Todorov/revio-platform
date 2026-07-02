import "server-only";
import { prisma } from "./db";
import { computeAvailability, deriveRate, isAdvancePurchaseClosed, type AriUpdate, type DerivedRateConfig } from "@revio/core";
import { createChannelAdapter, type AdapterMode } from "@revio/connectivity";

/** How many days of ARI a manual Re-sync pushes. */
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

/** The Channex key for a mode comes from env (per-tenant encrypted storage is the operator phase). */
function channexKey(mode: string): string {
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
 * and an ErrorItem per rejected update. This is the real `edit → derive → push` loop, opt-in per channel.
 */
export async function syncChannel(channelId: string): Promise<SyncOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, pushed: 0, rejected: 0, mode: "mock", error: "Unknown channel." };
  const property = await prisma.property.findUniqueOrThrow({ where: { id: channel.propertyId } });
  const { tenantId, propertyId } = channel;

  // Complete mappings only (a product is sendable when its room type AND rate plan are mapped).
  const [roomMaps, rateMaps] = await Promise.all([
    prisma.channelRoomTypeMapping.findMany({ where: { channelId, status: "complete", externalRoomId: { not: null } }, include: { roomType: true } }),
    prisma.channelRatePlanMapping.findMany({ where: { channelId, status: "complete", externalRateId: { not: null } }, include: { ratePlan: true } }),
  ]);

  const start = new Date(`${ymd(new Date())}T00:00:00Z`);
  const end = new Date(start.getTime() + (HORIZON_DAYS - 1) * DAY_MS);
  const dates = Array.from({ length: HORIZON_DAYS }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  const todayStr = ymd(start);

  const roomTypeIds = roomMaps.map((m) => m.roomTypeId);

  // Pull everything for the horizon up front, then assemble in memory.
  const [cells, prices, resLines] = await Promise.all([
    prisma.dailyCell.findMany({ where: { roomTypeId: { in: roomTypeIds }, date: { gte: start, lte: end } } }),
    prisma.ratePrice.findMany({ where: { propertyId, date: { gte: start, lte: end } } }),
    prisma.reservationLine.findMany({
      where: { roomTypeId: { in: roomTypeIds }, reservation: { propertyId, status: { in: ["confirmed", "modified", "overbooked"] } } },
      select: { roomTypeId: true, quantity: true, checkIn: true, checkOut: true },
    }),
  ]);

  const cellKey = (rt: string, k: string) => `${rt}:${k}`;
  const cellMap = new Map(cells.map((c) => [cellKey(c.roomTypeId, ymd(c.date)), c]));
  const priceMap = new Map(prices.map((p) => [`${p.roomTypeId}:${p.ratePlanId}:${ymd(p.date)}`, p.priceMinor]));

  // Resolve each rate plan's price for a room/date: manual = stored row; derived = computed from parent.
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
  for (const rm of roomMaps) {
    const rt = rm.roomType;
    for (const d of dates) {
      const k = ymd(d);
      const cell = cellMap.get(cellKey(rt.id, k));
      const inventory = cell?.inventory ?? rt.totalRooms;
      const sold = resLines.filter((l) => l.roomTypeId === rt.id && l.checkIn <= d && d < l.checkOut).reduce((s, l) => s + l.quantity, 0);
      const bookable = computeAvailability({ inventory, confirmedUnits: sold });

      for (const pm of rateMaps) {
        const rp = pm.ratePlan;
        const price = priceFor(rt.id, rp, k);
        if (price == null) continue; // nothing to send for this product/date

        const apClosed = isAdvancePurchaseClosed(todayStr, k, { min: rp.defAdvancePurchaseMin, max: rp.defAdvancePurchaseMax });
        const stopSell = (cell?.stopSell ?? false) || apClosed;
        const restrictions: AriUpdate["restrictions"] = {
          stopSell,
          cta: cell?.cta ?? false,
          ctd: cell?.ctd ?? false,
        };
        const minLos = cell?.minLos ?? rp.defMinLos;
        if (minLos != null) restrictions.minLos = minLos;
        if (rp.defMaxLos != null) restrictions.maxLos = rp.defMaxLos;
        if (rp.defAdvancePurchaseMin != null) restrictions.advancePurchaseMin = rp.defAdvancePurchaseMin;
        if (rp.defAdvancePurchaseMax != null) restrictions.advancePurchaseMax = rp.defAdvancePurchaseMax;

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
      ? { channex: { apiKey: channexKey(channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
      : {}),
  });

  const result = await adapter.pushAri(updates);

  // Record the push + any rejections, and refresh the channel's health counters.
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
 * Called after ARI-affecting edits so channex-mode channels receive the change without a manual
 * Re-sync. A no-op when every channel is mock (the default), so demo flows are unaffected.
 */
export async function syncRealChannels(propertyId: string): Promise<void> {
  const real = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: { not: "mock" } },
    select: { id: true },
  });
  for (const c of real) {
    try {
      await syncChannel(c.id);
    } catch {
      // syncChannel records its own SyncEvent/ErrorItems; never block the user's edit on a push failure.
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

/** How far back a pull looks. Overlapping pulls are safe — reservations dedupe on externalId. */
const PULL_LOOKBACK_DAYS = 7;

/**
 * Pull bookings from the channel's adapter and import them: new bookings become Reservations
 * (availability self-corrects because "sold" is derived from confirmed reservations), status changes
 * (e.g. cancellations) update in place, and bookings that can't be mapped land as failed_import +
 * an Error Center item. Overbookings are flagged, not silently absorbed.
 */
export async function pullChannel(channelId: string): Promise<PullOutcome> {
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
      ? { channex: { apiKey: channexKey(channel.connectivityMode), propertyId: channel.externalPropertyId ?? "" } }
      : {}),
  });

  const since = new Date(Date.now() - PULL_LOOKBACK_DAYS * DAY_MS).toISOString();
  let raws;
  try {
    raws = await adapter.pullReservations(since);
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
      // Status change (e.g. cancellation): update in place — derived "sold" self-corrects availability.
      if (existing.status !== status && existing.status !== "cancelled") {
        await prisma.reservation.update({ where: { id: existing.id }, data: { status } });
        updated++;
      } else {
        unchanged++;
      }
      continue;
    }

    // Map the booking's lines through the two-stream mappings.
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
      // Import it visibly as failed so the hotel can debug — never drop a booking silently.
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

    // Overbooking check: would any night dip below zero once this booking lands?
    let overbooked = false;
    for (const line of lines) {
      const room = roomMaps.find((m) => m.roomTypeId === line.roomTypeId);
      for (let t = line.checkIn.getTime(); t < line.checkOut.getTime(); t += DAY_MS) {
        const d = new Date(t);
        const cell = await prisma.dailyCell.findUnique({ where: { roomTypeId_date: { roomTypeId: line.roomTypeId, date: d } } });
        const inventory = cell?.inventory ?? room?.roomType.totalRooms ?? 0;
        const soldAgg = await prisma.reservationLine.aggregate({
          _sum: { quantity: true },
          where: { roomTypeId: line.roomTypeId, checkIn: { lte: d }, checkOut: { gt: d }, reservation: { status: { in: ["confirmed", "modified", "overbooked"] } } },
        });
        const sold = soldAgg._sum.quantity ?? 0;
        if (inventory - (sold + line.quantity) < 0) overbooked = true;
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

  await prisma.syncEvent.create({
    data: {
      tenantId, propertyId, channelId, kind: "pull", status: "success",
      summary: `Pulled ${raws.length} bookings from ${channel.name} (${imported} new · ${updated} updated · ${unchanged} unchanged)`,
    },
  });
  await prisma.channel.update({ where: { id: channelId }, data: { lastSyncAt: new Date() } });

  // A new/changed booking changes availability → re-push so other channels can't oversell.
  if (imported > 0 || updated > 0) await syncRealChannels(propertyId);

  return { ok: true, imported, updated, unchanged, mode: channel.connectivityMode };
}
