/**
 * Which products the Mapping screen lists — everything the hotel sells, not only what was
 * provisioned.
 *
 * ## The defect
 *
 * `ChannelRoomTypeMapping` / `ChannelRatePlanMapping` rows are created once, by
 * `provisionChannexProperty`, from whatever existed the moment the channel was connected.
 * Provisioning is ONE-SHOT (root `CLAUDE.md`) — so every room type and rate plan added afterwards has
 * no row at all, and a screen that lists rows cannot show it.
 *
 * A tester reported that on 2026-09-12 as two bugs: a hotel with three room types was offered two to
 * map, and both its rate-plan rows named a plan it had switched off. Neither was a mapping failure.
 * The products were invisible because they had never been sent, and the screen had no way to say so.
 *
 * ## The rule
 *
 * One row per **sellable** product — active, and for rate plans, manual, since a derived plan follows
 * its parent and is never mapped separately. A product with no mapping yet is a row marked
 * `never_sent`, which can be mapped like any other; the write side creates the missing row.
 *
 * ⚠️ A product that is switched OFF but still has a mapping row is kept, deliberately. It is
 * currently sent to the channel, and hiding it would leave a hotel unable to see or undo something
 * live — worse than showing a row they no longer need.
 */

export interface MappableProduct {
  id: string;
  name: string;
  active: boolean;
  /** Rate plans only. `derived` plans follow a parent and are never mapped on their own. */
  priceLogic?: string;
}

export interface ExistingMapping {
  id: string;
  /** The local room type / rate plan this row maps. */
  productId: string;
  externalId: string | null;
  status: string;
}

export interface MappingRow {
  /** The mapping row's id, or null when this product has never been sent to the channel. */
  id: string | null;
  productId: string;
  name: string;
  externalId: string | null;
  /** `complete` · `incomplete` · `never_sent` */
  status: string;
  unmapped: boolean;
}

export function mappingRows(
  products: readonly MappableProduct[],
  existing: readonly ExistingMapping[],
  kind: "room" | "rate",
): MappingRow[] {
  const byProduct = new Map(existing.map((m) => [m.productId, m]));

  return products
    .filter((p) => {
      // Already mapped → always shown, even if switched off: it is live on the channel right now.
      if (byProduct.has(p.id)) return true;
      if (!p.active) return false;
      // A derived plan takes its price from a parent and has nothing of its own to map.
      return kind === "room" || p.priceLogic === "manual";
    })
    .map((p) => {
      const m = byProduct.get(p.id);
      return m
        ? { id: m.id, productId: p.id, name: p.name, externalId: m.externalId, status: m.status, unmapped: false }
        : { id: null, productId: p.id, name: p.name, externalId: null, status: "never_sent", unmapped: true };
    });
}

/** How many products still cannot reach the channel. Drives the "needs attention" count. */
export function unmappedCount(rows: readonly MappingRow[]): number {
  return rows.filter((r) => r.status !== "complete").length;
}
