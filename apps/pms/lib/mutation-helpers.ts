import "server-only";
import { decimalOr, intOr, minorUnitsOr } from "@revio/core";
import { syncRealChannels, type PushScope } from "@revio/connectivity";
import { prisma } from "./db";

/*
 * Several helpers below take an optional `db`.
 *
 * They already receive propertyId and tenantId explicitly, so the only thing they needed the
 * request-scoped proxy for was a connection — and that proxy demands a session. The automatic Close
 * Day runs from cron, for properties nobody is logged into, so it has none. Passing a client keeps
 * one implementation for both callers instead of a second, unattended copy that drifts.
 * Same shape the CRS already uses for `releaseExpiredHolds(client = prisma)`.
 */
type Db = typeof prisma;

/** Record an Audit Log entry. Every hand-made operational change is permanent and attributable. */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string; userId?: string },
  db: Db = prisma,
) {
  await db.auditEntry.create({
    data: {
      tenantId, propertyId,
      userId: entry.userId ?? null,
      entity: entry.entity,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      source: entry.source ?? "manual",
      channelCode: "all",
      syncResult: "success",
    },
  });
}

/**
 * Record a sync event so the shared Sync Center reflects a PMS-originated inventory change (e.g. a
 * Unit going out-of-order writes a RoomInventoryPeriod → the waterfall drops a room → the CM sends it
 * on its next push). This is the visible trace of the one cross-product write.
 */
export async function recordSync(propertyId: string, tenantId: string, summary: string, detail?: string, scope?: PushScope, db: Db = prisma) {
  // BOUNDARY RULE (spec CM-GUIDE-V2 §1): callers pass the AVAILABILITY EFFECT only — never the
  // operational cause (no unit labels, guest names, maintenance notes). Channel attribution
  // (spec §5.1): one event per connected mock channel; real channels report their own pushes.
  const mocks = await db.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: "mock" },
    select: { id: true, name: true },
  });
  if (mocks.length === 0) {
    await db.syncEvent.create({
      data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: detail ?? null },
    });
  } else {
    await db.syncEvent.createMany({
      data: mocks.map((c) => ({ tenantId, propertyId, channelId: c.id, kind: "push", status: "success", summary, detail: detail ?? null })),
    });
  }
  // Immediate cross-product propagation: a PMS inventory change (unit OOO, walk-in) pushes the new
  // availability to any real (channex) channel now. No-op when every channel is mock; never break the write.
  try {
  // A booking / OOO / walk-in changes AVAILABILITY, on the stay's own dates and room types — not
  // rates, and not the whole horizon. Callers that know the affected dates and rooms pass them;
  // an omitted scope still means a full push, which is the safe default for anything unclassified.
    await syncRealChannels(prisma, propertyId, scope);
  } catch {
    /* per-channel failures are already isolated inside syncRealChannels. */
  }
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
/**
 * An integer from a form field, or the fallback (Y1).
 *
 * ⚠️ This used to be `Number.isFinite(Number(fd.get(key))) ? … : fallback`, which looked careful and
 * was not: **`Number("")` is 0 and `Number(null)` is 0**. A user typing letters into an
 * `<input type="number">` makes the browser submit `""` — so "rooms to sell" silently became 0 and
 * closed the property out on every channel, VAT silently became 0%, and the `fallback` that 21 call
 * sites were passing could only ever fire for a non-numeric string a number input cannot produce.
 *
 * `intOr` in `@revio/core` returns the fallback for absent, blank AND unparseable, which is what
 * every call site already assumed. A real `0` is still a real `0`.
 */
export function int(fd: FormData, key: string, fallback = 0): number {
  return intOr(fd.get(key), fallback);
}

/** A decimal (rates, percentages). Same non-value handling as `int`. */
export function decimal(fd: FormData, key: string, fallback = 0): number {
  return decimalOr(fd.get(key), fallback);
}

/** Money: a major-unit field ("129.50") to integer minor units, converted from the string. */
export function money(fd: FormData, key: string, fallback = 0): number {
  return minorUnitsOr(fd.get(key), fallback);
}

export { utcDay } from "./format";
