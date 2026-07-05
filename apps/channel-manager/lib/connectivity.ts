import "server-only";
import { prisma } from "./db";
import {
  syncChannel as sharedSyncChannel,
  syncRealChannels as sharedSyncRealChannels,
  pullChannel as sharedPullChannel,
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
