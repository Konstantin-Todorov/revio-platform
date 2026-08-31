import "server-only";
import { decimalOr, intOr, minorUnitsOr } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { syncRealChannels } from "./connectivity";
import type { PushScope } from "@revio/connectivity";

/**
 * The signed-in user, or null when there is no request context (cron, scripts, webhooks).
 *
 * `cookies()` throws outside a request rather than returning empty, so this cannot be a plain call.
 */
async function currentActorId(): Promise<string | null> {
  try {
    return (await getSession())?.userId ?? null;
  } catch {
    return null;
  }
}


/**
 * Record an Audit Log entry. Every hand-made change is permanent and attributable.
 *
 * "Attributable" was an aspiration until 2026-09-01: this helper did not accept a user at all, so
 * every entry this app has ever written names no actor. 93 of 139 `logAudit` calls across the
 * platform recorded nothing about who acted, which makes an audit trail unable to answer the one
 * question it exists for.
 *
 * The actor is resolved HERE, from the session, rather than passed by 93 call sites. A caller may
 * still name one explicitly — a delegated action attributes to the person who performed it, not to
 * whoever happens to be signed in — and an explicit value always wins.
 *
 * Falls back to null rather than throwing when there is no request to read a session from: the
 * cron jobs and the night audit write audit entries too, and an unattributed entry is worth far
 * more than a crashed close-day.
 */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string; userId?: string; channelCode?: string | null },
) {
  await prisma.auditEntry.create({
    data: {
      tenantId, propertyId,
      userId: entry.userId ?? (await currentActorId()),
      entity: entry.entity,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      source: entry.source ?? "manual",
      // Channel attribution for channel-scoped actions (pause/resume/disconnect/sync — spec §3.5/§3.8).
      channelCode: entry.channelCode ?? "all",
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
/**
 * @param scope what the edit actually changed. Omit ONLY for a deliberate full sync — otherwise the
 * push restates the entire 14-day horizon for every mapped product, which Channex rejects as a
 * full-sync-instead-of-delta and which no single-value certification test can be satisfied by.
 */
export async function recordPush(propertyId: string, tenantId: string, summary: string, scope?: PushScope) {
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
  await syncRealChannels(propertyId, scope);
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
