import { prisma } from "./client.js";
import { ROOM_OCCUPYING_STATUSES } from "@revio/core";

/**
 * The atomic inventory claim (X1).
 *
 * ## The bug this exists to close
 *
 * Every claim path in the platform read availability and then wrote a Hold as two separate
 * statements:
 *
 *   const remaining = await remainingByNight(...)   // says 1 room left
 *   if (remaining < qty) return "sold out"
 *   await prisma.hold.create(...)                   // ← another request did the same thing here
 *
 * Two guests clicking the last room in the same second both read `remaining = 1`, both pass the
 * check, and both get a hold. The waterfall then reports `remaining = -1`, which is the platform
 * faithfully telling us it has oversold. This is the exact failure the whole product exists to
 * prevent, and it was in the CRS staff flow, the public booking engine, and the direct-reservation
 * path.
 *
 * ## Why it is done this way
 *
 * Three constraints shaped the fix, and it is worth writing them down because they rule out the
 * obvious approaches:
 *
 * 1. **The RLS proxy cannot run interactive transactions.** `forTenant()` wraps every model
 *    operation in its own `$transaction([setGuc, query])`. Calling `$transaction(async tx => …)` on
 *    that client would nest a transaction inside each operation's own transaction. So the check and
 *    the write cannot be bracketed in application code.
 * 2. **A conditional INSERT alone is not enough.** Under READ COMMITTED two concurrent
 *    `INSERT … WHERE (SELECT count …) < limit` statements both see the pre-insert state and both
 *    succeed. The condition must be evaluated under a lock, not merely inside one statement.
 * 3. **The availability waterfall must not be reimplemented in SQL.** It is pure, tested and lives
 *    once in `@revio/core`. A second copy in SQL would drift, and a drifting availability rule is a
 *    worse bug than the one being fixed.
 *
 * So the work is split by *how fast each input can change*:
 *
 * - **The sellable base per night** — physical rooms minus out-of-order minus closed, or the
 *   hotel's manual override. Staff change these, minutes or days apart. The caller computes them
 *   with the existing waterfall and passes them in. A race against a housekeeper marking a room
 *   out of order is not the double-booking scenario, and losing that race costs nothing worse than
 *   a hold the next availability read reports as overbooked.
 * - **Holds and occupying reservations** — the contended part, and the only thing another request
 *   can change in the milliseconds that matter. These are recounted **inside the lock, in SQL**.
 *
 * The transaction is the batch form (`$transaction([…])`), which is the same mechanism `rls.ts`
 * already uses, so the tenant GUC is set exactly as it is everywhere else:
 *
 *   1. `set_config('app.tenant_id', …, true)` — RLS scope, transaction-local.
 *   2. `pg_advisory_xact_lock(hashtextextended(roomTypeId))` — serialises every claimant for this
 *      room type. Transaction-scoped, so it is released on commit or rollback and can never leak
 *      across a pooled connection. An advisory lock rather than `SELECT … FOR UPDATE` on the
 *      RoomType row on purpose: locking the row would block ordinary staff edits to the room type
 *      and invites deadlocks with any transaction that updates it.
 *   3. The conditional INSERT, now evaluated under that lock and therefore safe.
 *
 * Contention is one lock per room type per claim, held for a single statement. At hotel scale —
 * a few claims a second at the very worst — that is free.
 */

/** A night and the rooms sellable on it, from the caller's waterfall. Keys are `YYYY-MM-DD`. */
export type SellableByNight = Record<string, number>;

export interface ClaimHoldInput {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  /** Rooms wanted. */
  quantity: number;
  /** `YYYY-MM-DD`, exclusive of checkOut — a stay covers the nights [checkIn, checkOut). */
  checkIn: string;
  checkOut: string;
  expiresAt: Date;
  createdById?: string | null;
  /**
   * Sellable rooms per night, computed by the caller with `computeWaterfall`. Must cover every
   * night of the stay; a missing night is treated as zero, which fails the claim rather than
   * silently selling a night nobody priced.
   */
  sellableByNight: SellableByNight;
  /** A hold that must not count against itself — the confirm and modify flows re-claim their own. */
  excludeHoldId?: string | null;
  /** A reservation that must not count against itself — the modify flow moves its own dates. */
  excludeReservationId?: string | null;
}

export type ClaimResult =
  | { ok: true; holdId: string }
  | { ok: false; reason: "sold-out" | "no-nights" };

/** The nights a stay occupies: checkIn inclusive, checkOut exclusive. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  for (let t = new Date(`${checkIn}T00:00:00Z`).getTime(); t < end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Claim inventory and create the hold, atomically, or claim nothing at all.
 *
 * Returns `{ ok: false, reason: "sold-out" }` when another claimant got there first. Callers should
 * treat that as a real, user-facing outcome — "that room has just been taken" — and never as an
 * error to retry silently, because retrying would take the room from whoever legitimately won it.
 */
export async function claimHold(input: ClaimHoldInput): Promise<ClaimResult> {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights.length === 0 || input.quantity < 1) return { ok: false, reason: "no-nights" };

  // A night the caller did not price is worth zero rooms, not unlimited ones.
  const sellable = nights.map((d) => Math.max(0, Math.trunc(input.sellableByNight[d] ?? 0)));

  const occupying = [...ROOM_OCCUPYING_STATUSES];

  const rows = await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`,
    // Serialise every claimant for this room type for the rest of the transaction. Released on
    // commit or rollback — there is no unlock to forget and nothing to leak onto a pooled connection.
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.roomTypeId}, 0))`,
    prisma.$queryRaw<{ id: string }[]>`
      WITH nights AS (
        SELECT n.night::date AS night, n.sellable
        FROM unnest(${nights}::text[], ${sellable}::int[]) AS n(night, sellable)
      ),
      usage AS (
        SELECT
          ni.night,
          ni.sellable,
          COALESCE((
            SELECT SUM(h.quantity) FROM "Hold" h
            WHERE h."roomTypeId" = ${input.roomTypeId}
              AND h.status = 'active'
              AND h."expiresAt" > now()
              AND h."checkIn" <= ni.night AND h."checkOut" > ni.night
              AND (${input.excludeHoldId ?? null}::text IS NULL OR h.id <> ${input.excludeHoldId ?? null}::text)
          ), 0) AS held,
          COALESCE((
            SELECT SUM(rl.quantity) FROM "ReservationLine" rl
            JOIN "Reservation" r ON r.id = rl."reservationId"
            WHERE rl."roomTypeId" = ${input.roomTypeId}
              AND r.status = ANY(${occupying}::text[])
              AND rl."checkIn" <= ni.night AND rl."checkOut" > ni.night
              AND (${input.excludeReservationId ?? null}::text IS NULL OR r.id <> ${input.excludeReservationId ?? null}::text)
          ), 0) AS booked
        FROM nights ni
      )
      INSERT INTO "Hold" (
        id, "tenantId", "propertyId", "roomTypeId", quantity,
        "checkIn", "checkOut", status, "expiresAt", "createdById", "createdAt"
      )
      SELECT
        gen_random_uuid()::text, ${input.tenantId}, ${input.propertyId}, ${input.roomTypeId}, ${input.quantity},
        ${input.checkIn}::date, ${input.checkOut}::date, 'active', ${input.expiresAt}, ${input.createdById ?? null}, now()
      WHERE NOT EXISTS (
        SELECT 1 FROM usage WHERE held + booked + ${input.quantity} > sellable
      )
      RETURNING id
    `,
  ]);

  // `rows` is the third statement's result. An empty array means the WHERE NOT EXISTS failed —
  // somebody else has the room.
  const inserted = rows[2] as { id: string }[];
  const holdId = inserted[0]?.id;
  return holdId ? { ok: true, holdId } : { ok: false, reason: "sold-out" };
}

/**
 * ⚠️ The id is a UUID, not a cuid.
 *
 * Every other row in the database gets its id from Prisma's `@default(cuid())`, which runs in the
 * client — and this insert is raw SQL, so Prisma is not in the loop to generate one. `gen_random_uuid()`
 * is the database's own guarantee of uniqueness, which is a better thing to depend on here than a
 * hand-rolled cuid lookalike. Hold ids are opaque: they appear in a query string and in a `where`
 * clause and nothing parses them, so the shape difference is invisible.
 */
