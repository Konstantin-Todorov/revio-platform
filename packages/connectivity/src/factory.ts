/**
 * Per-tenant adapter selection. A hotel's channel runs on the mock (demo), the Channex sandbox
 * (internal testing), or Channex production (real client) — chosen by a single mode flag so one
 * deployment serves all three at once. Demo hotels must always stay on "mock"; never point a real
 * adapter at demo data.
 */

import { type ChannelAdapter, MockChannelAdapter } from "@revio/core";
import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "./channex-channel-adapter.js";

export type AdapterMode = "mock" | "channex-sandbox" | "channex-prod";

export interface AdapterSelection {
  mode: AdapterMode;
  channelCode: string;
  /** Required for channex-* modes. apiKey + Channex property UUID (our Channel.externalPropertyId). */
  channex?: { apiKey: string; propertyId: string; baseUrl?: string };
}

/** Production base comes from Channex at certification; override via channex.baseUrl until then. */
const CHANNEX_PRODUCTION_URL = "https://secure.channex.io/api/v1";

export function createChannelAdapter(selection: AdapterSelection): ChannelAdapter {
  if (selection.mode === "mock") {
    return new MockChannelAdapter({ channelCode: selection.channelCode });
  }

  const cfg = selection.channex;
  if (!cfg) {
    throw new Error(`createChannelAdapter: mode "${selection.mode}" requires channex credentials.`);
  }

  const baseUrl =
    cfg.baseUrl ?? (selection.mode === "channex-prod" ? CHANNEX_PRODUCTION_URL : CHANNEX_STAGING_URL);

  return new ChannexChannelAdapter({
    apiKey: cfg.apiKey,
    propertyId: cfg.propertyId,
    baseUrl,
    channelCode: selection.channelCode,
  });
}
