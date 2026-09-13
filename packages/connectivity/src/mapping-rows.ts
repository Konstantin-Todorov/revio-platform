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

/* ─────────────────────────────────────────────────────────────────────────────
 * Rate-plan mapping, scoped to the room type
 * ───────────────────────────────────────────────────────────────────────────*/

/**
 * ⚠️ **Channex holds one rate plan PER ROOM TYPE; Revio holds one per property.**
 *
 * That mismatch is the whole of BUG-019, and it was proven in production on 13 Sept: a €666 price
 * set on *Apartment, 1 Bedroom* was published against *Apartment, 2 Bedrooms*, silently, with no
 * error anywhere. The cause is a mapping row with `roomTypeId = NULL` — a **catch-all** — so every
 * room type's prices funnel into whichever single Channex rate plan that row happens to name.
 *
 * The engine has always been able to express the right shape: `ChannelRatePlanMapping.roomTypeId`
 * exists and `resolveExternalRateId` prefers a room-specific row over a catch-all. What was missing
 * is that **the screen never offered the choice**, so every row it wrote was a catch-all.
 *
 * This produces one row per **(room type, rate plan)** pair the hotel actually sells, which is the
 * only shape that can be mapped correctly.
 *
 * ## ⚠️ A catch-all is reported as UNCONFIRMED, never as complete
 *
 * An existing catch-all row does still push — `resolveExternalRateId` falls back to it — so hiding
 * it would be wrong. But showing it as `complete` is what let the €666 fault sit unnoticed: the
 * screen said everything was mapped while two of three room types were publishing to the wrong
 * place. It is surfaced as its own state so the hotel is asked to confirm it, once.
 */

export interface RoomScopedProduct {
  id: string;
  name: string;
  active: boolean;
  priceLogic?: string;
}

export interface ExistingRateMapping {
  id: string;
  ratePlanId: string;
  /** Null = a catch-all row: applies to every room type. The shape BUG-019 is about. */
  roomTypeId: string | null;
  externalId: string | null;
  status: string;
}

export interface RoomScopedMappingRow {
  /** The mapping row's id, or null when this pair has never been sent. */
  id: string | null;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  externalId: string | null;
  /** `complete` · `incomplete` · `never_sent` · `unconfirmed` (inherited from a catch-all row). */
  status: string;
  unmapped: boolean;
  /** True when the only thing covering this pair is a property-wide row — see the note above. */
  fromCatchAll: boolean;
  /**
   * What that catch-all is currently publishing to, for context only.
   *
   * ⚠️ Deliberately NOT offered as the value to save. For the 1-Bedroom the inherited id is the
   * 2-Bedroom's rate plan — prefilling it would invite the hotel to confirm the exact fault this
   * screen exists to end, in one click, believing they had checked it.
   */
  inheritedExternalId?: string | null;
}

export function ratePlanMappingRows(args: {
  roomTypes: readonly RoomScopedProduct[];
  ratePlans: readonly RoomScopedProduct[];
  /** Which room types each plan is sold on — `RatePlanRoomType`. */
  sellsOn: (roomTypeId: string, ratePlanId: string) => boolean;
  existing: readonly ExistingRateMapping[];
}): RoomScopedMappingRow[] {
  const specific = new Map<string, ExistingRateMapping>();
  const catchAll = new Map<string, ExistingRateMapping>();
  for (const m of args.existing) {
    if (m.roomTypeId) specific.set(`${m.roomTypeId}|${m.ratePlanId}`, m);
    else catchAll.set(m.ratePlanId, m);
  }

  const rows: RoomScopedMappingRow[] = [];

  for (const rt of args.roomTypes) {
    // An inactive room type sells nothing, so there is nothing to map it to.
    if (!rt.active) continue;

    for (const rp of args.ratePlans) {
      /*
       * Same two rules as the property-wide list: a DERIVED plan follows its parent and is never
       * mapped on its own, and an inactive plan is offered only when it already has a live mapping
       * (hiding that would leave a hotel unable to undo something still being pushed).
       */
      if (rp.priceLogic === "derived") continue;
      if (!args.sellsOn(rt.id, rp.id)) continue;

      const hit = specific.get(`${rt.id}|${rp.id}`);
      const inherited = hit ? null : catchAll.get(rp.id);

      if (!rp.active && !hit && !inherited) continue;

      if (hit) {
        rows.push({
          id: hit.id, roomTypeId: rt.id, roomTypeName: rt.name, ratePlanId: rp.id, ratePlanName: rp.name,
          externalId: hit.externalId, status: hit.externalId ? hit.status : "incomplete",
          unmapped: !hit.externalId, fromCatchAll: false,
        });
        continue;
      }

      if (inherited) {
        /*
         * ⚠️ `id: null` and `externalId: null` — saving CREATES a room-specific row rather than
         * mutating the catch-all.
         *
         * Mutating it would silently strip the fallback from every OTHER room still relying on it,
         * mid-way through the hotel's own cleanup. Creating alongside leaves the catch-all doing
         * exactly what it did until every pair has been confirmed, at which point it is dead weight
         * and can be removed deliberately.
         */
        rows.push({
          id: null, roomTypeId: rt.id, roomTypeName: rt.name, ratePlanId: rp.id, ratePlanName: rp.name,
          externalId: null,
          status: "unconfirmed",
          unmapped: true,
          fromCatchAll: true,
          inheritedExternalId: inherited.externalId,
        });
        continue;
      }

      rows.push({
        id: null, roomTypeId: rt.id, roomTypeName: rt.name, ratePlanId: rp.id, ratePlanName: rp.name,
        externalId: null, status: "never_sent", unmapped: true, fromCatchAll: false,
      });
    }
  }

  return rows;
}

/** How many pairs still need a human — never-sent, incomplete, or inherited from a catch-all. */
export function unconfirmedPairs(rows: readonly RoomScopedMappingRow[]): number {
  return rows.filter((r) => r.unmapped).length;
}

/**
 * Channex rate plans bound to more than one of the hotel's room types.
 *
 * ⚠️ **One Channex rate plan belongs to exactly one room type**, so two of ours pointing at the same
 * id means one room's prices overwrite the other's on every push — the later one wins and nothing
 * says so. It is the same failure as BUG-019 with a different cause: there the mapping was
 * property-wide, here two room-scoped rows simply collide.
 *
 * Found in production on 13 Sept: the inactive `Standard Rate` held two rows, for two different
 * room types, both pointing at `0ea321e7…`. Reported in the 13 Sept log as a duplicate row; it is
 * not — a duplicate would be harmless. This is two rooms publishing to one place.
 *
 * Returned rather than blocked: the hotel may be mid-way through re-mapping, and refusing to render
 * a screen because its data is currently inconsistent is how somebody gets stuck with no way to fix
 * it. The screen warns at the point of choice, which is §4.3 rule 5.
 */
export function collidingExternalIds(
  rows: readonly RoomScopedMappingRow[],
): { externalId: string; rooms: { roomTypeId: string; roomTypeName: string; ratePlanName: string }[] }[] {
  const byId = new Map<string, { roomTypeId: string; roomTypeName: string; ratePlanName: string }[]>();
  for (const r of rows) {
    if (!r.externalId) continue;
    const list = byId.get(r.externalId) ?? [];
    // The same room mapped twice to one id is not a collision — it is one binding, listed once.
    if (!list.some((x) => x.roomTypeId === r.roomTypeId)) {
      list.push({ roomTypeId: r.roomTypeId, roomTypeName: r.roomTypeName, ratePlanName: r.ratePlanName });
    }
    byId.set(r.externalId, list);
  }
  return [...byId.entries()]
    .filter(([, rooms]) => rooms.length > 1)
    .map(([externalId, rooms]) => ({ externalId, rooms }));
}
