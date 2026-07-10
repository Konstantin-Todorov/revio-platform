/**
 * MockChannelAdapter — lets the entire ARI loop run on seeded demo data before any real OTA
 * certification. It records pushes (so the Sync Center has real activity), can deterministically
 * reject specific updates (so the Error Center has real items), and can emit synthetic bookings
 * (so Reservations import and availability drops for real).
 *
 * This is demo plumbing, but it implements the SAME ChannelAdapter contract as a real OTA, so the
 * apps cannot tell the difference. When a real adapter exists, the apps don't change.
 */

import type { ExternalProduct,
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

// OTA-style demo products per channel (stable ids so saved mappings keep resolving). The demo
// mapping dropdown shows these exactly like a real Channex product pull would.
const MOCK_PRODUCTS: Record<string, { prefix: string; base: number }> = {
  booking: { prefix: "BDC", base: 84500 },
  expedia: { prefix: "EXP", base: 21870 },
  trip: { prefix: "TRP", base: 60310 },
  agoda: { prefix: "AGD", base: 99050 },
};
const MOCK_ROOM_NAMES = ["Double Room", "Twin Room", "Family Room", "Suite", "Single Room", "Studio / Apartment"];
const MOCK_RATE_NAMES = ["Standard Rate", "Non-Refundable Rate", "Bed & Breakfast", "Long Stay Deal", "Mobile Rate", "Early Booker", "Corporate Rate"];

export class MockChannelAdapter implements ChannelAdapter {
  readonly channelCode: string;
  /** Everything pushed, newest last — the Sync Center reads from here in the demo. */
  readonly pushed: AriUpdate[] = [];
  private readonly unsupported: Set<string>;

  constructor(options: MockChannelOptions) {
    this.channelCode = options.channelCode;
    this.unsupported = new Set(options.unsupportedRestrictions ?? []);
  }

  async listProducts(): Promise<{ rooms: ExternalProduct[]; rates: ExternalProduct[] }> {
    const cfg = MOCK_PRODUCTS[this.channelCode] ?? { prefix: this.channelCode.toUpperCase().slice(0, 3), base: 10000 };
    return {
      rooms: MOCK_ROOM_NAMES.map((name, i) => ({ id: `${cfg.prefix}-${cfg.base + i}`, name })),
      rates: MOCK_RATE_NAMES.map((name, i) => ({ id: `${cfg.prefix}-R${cfg.base + 500 + i}`, name })),
    };
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
