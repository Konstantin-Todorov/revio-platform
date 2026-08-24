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

/**
 * Production base URL.
 *
 * ⚠️ CHANGED 2026-08-15 on Channex's own instruction: *"You should change to use app.channex.io
 * instead of staging.channex.io"*. This constant previously read `secure.channex.io`, which was a
 * guess made before certification and had never been exercised — the sandbox was the only base URL
 * this platform had ever actually talked to. A wrong host here fails at the worst possible moment:
 * the first real hotel's first real push.
 *
 * Still overridable per-channel via `channex.baseUrl`, which is how the sandbox and any future
 * region-specific host are selected without a deploy.
 */
const CHANNEX_PRODUCTION_URL = "https://app.channex.io/api/v1";

export function createChannelAdapter(selection: AdapterSelection): ChannelAdapter {
  if (selection.mode === "mock") {
    return new MockChannelAdapter({ channelCode: selection.channelCode });
  }

  const cfg = selection.channex;
  if (!cfg) {
    throw new Error(`createChannelAdapter: mode "${selection.mode}" requires channex credentials.`);
  }

  // Empty is not the same as missing, and it used to be treated as if it were. Both of these arrive
  // as `""` from perfectly ordinary call sites — `process.env.CHANNEX_PROD_KEY ?? ""` when nobody set
  // the variable, `channel.externalPropertyId ?? ""` on a channel created but not yet pointed at a
  // Channex property. Neither is a programming error; both are a hotel that is half-configured.
  //
  // Without this guard the request went out with an empty `user-api-key` header and came back 401,
  // which reads as "Channex rejected us" — so the hotel is told their channel is broken and we go
  // looking at Channex's status page. The cause is ours and it is one missing field. Say so here,
  // before the network call, where the message can name the fix.
  if (!cfg.apiKey.trim()) {
    throw new Error(
      `No Channex API key for this hotel (${selection.mode}). Add it in the Operator console under ` +
        `Connectivity, or set ${selection.mode === "channex-prod" ? "CHANNEX_PROD_KEY" : "CHANNEX_SANDBOX_KEY"}.`,
    );
  }
  if (!cfg.propertyId.trim()) {
    throw new Error(
      "This channel has no Channex property ID. Open the channel and set the property it maps to.",
    );
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
