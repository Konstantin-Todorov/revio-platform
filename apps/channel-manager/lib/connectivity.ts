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
} from "@revio/connectivity";

// The connectivity orchestration now lives in @revio/connectivity so CRS + PMS can trigger it too
// (a cross-product inventory change pushes to Channex immediately). These thin wrappers bind the CM's
// request-scoped RLS proxy, keeping every existing CM call site (`syncChannel(id)` etc.) unchanged.

export type { SyncOutcome, PullOutcome };

export function syncChannel(channelId: string): Promise<SyncOutcome> {
  return sharedSyncChannel(prisma, channelId);
}

export function syncRealChannels(propertyId: string): Promise<void> {
  return sharedSyncRealChannels(prisma, propertyId);
}

export function pullChannel(channelId: string): Promise<PullOutcome> {
  return sharedPullChannel(prisma, channelId);
}

/** Manual full sync — the on-demand recovery push (365 days through the normal queue, spec §3.5). */
export function fullSyncChannel(channelId: string) {
  return sharedSyncChannel(prisma, channelId, { horizonDays: 365 });
}
export const listChannelProducts = (id: string) => sharedListChannelProducts(prisma, id);
export const pauseChannel = (id: string) => sharedPauseChannel(prisma, id);
export const resumeChannel = (id: string) => sharedResumeChannel(prisma, id);
export const disconnectChannel = (id: string) => sharedDisconnectChannel(prisma, id);
export const reconnectChannel = (id: string) => sharedReconnectChannel(prisma, id);
