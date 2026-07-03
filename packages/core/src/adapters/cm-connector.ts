/**
 * The "Connected Channel Manager" — the CRS's ONE way out to distribution
 * (docs/CRS-REFERENCE.md "Core architecture decision"). Every property connects to exactly one
 * CM; the CRS never talks to an individual OTA — full stop. RevioLink is just the DEFAULT value
 * of this connection, not a special case: a third-party CM (SiteMinder, RoomRaccoon, …) implements
 * the same interface later. One integration pattern, never two code paths.
 */

export interface CmAvailabilityUpdate {
  roomTypeCode: string;
  date: string; // YYYY-MM-DD
  bookable: number;
}

export interface CmPushResult {
  ok: boolean;
  /** How the update reached the CM. */
  transport: "internal" | "api";
  detail: string;
}

export interface ChannelManagerConnector {
  /** Stable identifier, e.g. "reviolink_internal" | "siteminder" | … */
  readonly kind: string;
  readonly displayName: string;
  /** Push availability the CM should distribute. */
  pushAvailability(updates: CmAvailabilityUpdate[]): Promise<CmPushResult>;
}

/**
 * RevioLink on the same platform: CM and CRS are two lenses over the SAME database rows, so a
 * "push" has nothing to transmit — the CM's channel pushes already derive availability from the
 * shared waterfall (reservations, holds, OOO periods) the moment the CRS writes them. This
 * connector exists so the CRS code path is IDENTICAL whether the CM is ours or a third party's.
 */
export class RevioLinkInternalConnector implements ChannelManagerConnector {
  readonly kind = "reviolink_internal";
  readonly displayName = "RevioLink (this platform)";

  async pushAvailability(updates: CmAvailabilityUpdate[]): Promise<CmPushResult> {
    return {
      ok: true,
      transport: "internal",
      detail: `${updates.length} updates visible to RevioLink instantly (shared inventory core — no network call)`,
    };
  }
}

/** Per-property connector selection. Third-party impls register here when they exist. */
export function createCmConnector(kind: string | null | undefined): ChannelManagerConnector {
  switch (kind) {
    case undefined:
    case null:
    case "":
    case "reviolink_internal":
      return new RevioLinkInternalConnector();
    default:
      throw new Error(`Unknown channel-manager connector: ${kind}`);
  }
}
