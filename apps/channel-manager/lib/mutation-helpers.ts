import "server-only";
import { prisma } from "./db";
import { syncRealChannels } from "./connectivity";

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
 * Record a push with CHANNEL ATTRIBUTION (spec CM-GUIDE-V2 §5.1): one SyncEvent per connected
 * mock channel (simulated push), so per-channel health bars and the Sync Center channel column
 * populate. Real (channex) channels are excluded here — syncRealChannels writes their own
 * attributed events with actual push results. Then auto-push through every real adapter.
 */
export async function recordPush(propertyId: string, tenantId: string, summary: string) {
  const mocks = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: "mock" },
    select: { id: true, name: true },
  });
  if (mocks.length === 0) {
    await prisma.syncEvent.create({
      data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: "No mock channels — real channels report their own pushes" },
    });
  } else {
    await prisma.syncEvent.createMany({
      data: mocks.map((c) => ({ tenantId, propertyId, channelId: c.id, kind: "push", status: "success", summary, detail: `Pushed to ${c.name} (mock)` })),
    });
  }
  await syncRealChannels(propertyId);
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
export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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
