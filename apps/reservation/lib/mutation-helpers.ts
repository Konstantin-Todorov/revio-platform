import "server-only";
import { decimalOr, intOr, minorUnitsOr } from "@revio/core";
import { syncRealChannels, type PushScope } from "@revio/connectivity";
import { prisma } from "./db";

/** Record an Audit Log entry. Every hand-made change is permanent and attributable. */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string },
) {
  await prisma.auditEntry.create({
    data: {
      tenantId, propertyId,
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
 * Record a push so the Sync Center shows activity, then AUTO-PUSH the change through every channel
 * that runs a real adapter (connectivityMode != mock). Mock channels keep the simulated event only;
 * channex-mode channels get an actual ARI push — no manual Re-sync needed after an edit.
 */
export async function recordPush(propertyId: string, tenantId: string, summary: string, scope?: PushScope) {
  // Channel attribution (spec §5.1): one event per connected mock channel; real channels report
  // their own attributed pushes from syncRealChannels below.
  const mocks = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: "mock" },
    select: { id: true, name: true },
  });
  if (mocks.length === 0) {
    await prisma.syncEvent.create({
      data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: "Availability recalculated · real channels report their own pushes" },
    });
  } else {
    await prisma.syncEvent.createMany({
      data: mocks.map((c) => ({ tenantId, propertyId, channelId: c.id, kind: "push", status: "success", summary, detail: `Pushed to ${c.name} via the connected CM (mock)` })),
    });
  }
  // Immediate cross-product propagation: push the new availability/rates to any real (channex) channel
  // right now — no manual Re-sync in the CM. No-op when every channel is mock. Never break the write.
  try {
  // A booking / OOO / walk-in changes AVAILABILITY, on the stay's own dates and room types — not
  // rates, and not the whole horizon. Callers that know the affected dates and rooms pass them;
  // an omitted scope still means a full push, which is the safe default for anything unclassified.
    await syncRealChannels(prisma, propertyId, scope);
  } catch {
    /* syncRealChannels already isolates per-channel failures; guard the outer call too. */
  }
}

/** Record a pull (a booking arriving from a channel). */
export async function recordPull(propertyId: string, tenantId: string, summary: string, channelId?: string) {
  await prisma.syncEvent.create({
    data: { tenantId, propertyId, channelId: channelId ?? null, kind: "pull", status: "success", summary },
  });
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
export function strList(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter(Boolean);
}

const DAY = 86_400_000;
export function eachDate(fromIso: string, toIso: string, daysOfWeek?: number[]): Date[] {
  const out: Date[] = [];
  const from = new Date(fromIso + "T00:00:00Z");
  const to = new Date(toIso + "T00:00:00Z");
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const d = new Date(t);
    if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(d.getUTCDay())) out.push(d);
  }
  return out;
}
export function utcDay(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}
