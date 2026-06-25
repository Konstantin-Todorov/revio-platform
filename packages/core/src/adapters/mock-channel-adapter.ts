/**
 * MockChannelAdapter — lets the entire ARI loop run on seeded demo data before any real OTA
 * certification. It records pushes (so the Sync Center has real activity), can deterministically
 * reject specific updates (so the Error Center has real items), and can emit synthetic bookings
 * (so Reservations import and availability drops for real).
 *
 * This is demo plumbing, but it implements the SAME ChannelAdapter contract as a real OTA, so the
 * apps cannot tell the difference. When a real adapter exists, the apps don't change.
 */

import type {
  AriUpdate,
  ChannelAdapter,
  PushResult,
  RawReservation,
} from "./channel-adapter.js";

export interface MockChannelOptions {
  channelCode: string;
  /** Restriction keys this mock pretends not to support, to generate Error Center items. */
  unsupportedRestrictions?: Array<keyof AriUpdate["restrictions"]>;
}

export class MockChannelAdapter implements ChannelAdapter {
  readonly channelCode: string;
  /** Everything pushed, newest last — the Sync Center reads from here in the demo. */
  readonly pushed: AriUpdate[] = [];
  private readonly unsupported: Set<string>;

  constructor(options: MockChannelOptions) {
    this.channelCode = options.channelCode;
    this.unsupported = new Set(options.unsupportedRestrictions ?? []);
  }

  async pushAri(updates: AriUpdate[]): Promise<PushResult> {
    const rejected: PushResult["rejected"] = [];
    for (const update of updates) {
      const usesUnsupported = Object.entries(update.restrictions).some(
        ([key, value]) =>
          value !== undefined && value !== false && this.unsupported.has(key),
      );
      if (usesUnsupported) {
        rejected.push({
          update,
          reason: `Restriction not supported by ${this.channelCode}`,
        });
        continue;
      }
      this.pushed.push(update);
    }
    return {
      ok: rejected.length === 0,
      rejected,
      channelResponseId: `mock-${this.channelCode}-${Date.now()}`,
    };
  }

  async pullReservations(_since: string): Promise<RawReservation[]> {
    // The demo seed drives bookings explicitly via emitReservation(); polling returns nothing.
    return [];
  }

  /** Demo helper: inject a booking as if a guest just booked on this channel. */
  emitReservation(reservation: RawReservation): RawReservation {
    return reservation;
  }
}
