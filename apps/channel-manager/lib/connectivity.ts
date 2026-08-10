import "server-only";
import { prisma } from "./db";
import {
  syncChannel as sharedSyncChannel,
  syncRealChannels as sharedSyncRealChannels,
  pullChannel as sharedPullChannel,
  listChannelProducts as sharedListChannelProducts,
  pauseChannel as sharedPauseChannel,
  resumeChannel as sharedResumeChannel,
  disconnectChannel as sharedDisconnectChannel,
  reconnectChannel as sharedReconnectChannel,
  type SyncOutcome,
  type PullOutcome,
  type PushScope,
  type PushField,
} from "@revio/connectivity";

// The connectivity orchestration now lives in @revio/connectivity so CRS + PMS can trigger it too
// (a cross-product inventory change pushes to Channex immediately). These thin wrappers bind the CM's
// request-scoped RLS proxy, keeping every existing CM call site (`syncChannel(id)` etc.) unchanged.

export type { SyncOutcome, PullOutcome, PushScope, PushField };

export function syncChannel(channelId: string): Promise<SyncOutcome> {
  return sharedSyncChannel(prisma, channelId);
}

export function syncRealChannels(propertyId: string, scope?: PushScope): Promise<void> {
  return sharedSyncRealChannels(prisma, propertyId, scope);
}

export function pullChannel(channelId: string): Promise<PullOutcome> {
  return sharedPullChannel(prisma, channelId);
}

/**
 * Manual full sync — the on-demand recovery push, through the normal queue (spec §3.5).
 *
 * The horizon is the PROPERTY's own `syncHorizonDays`. It was hardcoded to 365, which made the
 * setting on the Settings screen decorative: a hotel selling 500 days out could set 500, save it,
 * and still have the last 135 days never leave the building.
 */
export async function fullSyncChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { property: { select: { syncHorizonDays: true } } },
  });
  return sharedSyncChannel(prisma, channelId, { horizonDays: channel?.property.syncHorizonDays ?? 365 });
}
export const listChannelProducts = (id: string) => sharedListChannelProducts(prisma, id);
export const pauseChannel = (id: string) => sharedPauseChannel(prisma, id);
export const resumeChannel = (id: string) => sharedResumeChannel(prisma, id);
export const disconnectChannel = (id: string) => sharedDisconnectChannel(prisma, id);
export const reconnectChannel = (id: string) => sharedReconnectChannel(prisma, id);
