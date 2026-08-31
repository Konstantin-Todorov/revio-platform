import type { Prisma } from "@prisma/client";

/**
 * Claim the next пореден номер от регистъра for a property.
 *
 * The order calls it a "пореден номер" — a running number. Two receptionists checking in different
 * parties at the same second must not take the same one, and a plain `MAX(...) + 1` read outside a
 * lock gives them exactly that.
 *
 * `pg_advisory_xact_lock(hashtextextended(propertyId))` serialises claimants for this property only,
 * the same primitive `inventory-claim.ts` uses and for the same reason: a row lock would block
 * ordinary edits to the property and invites deadlocks, while a transaction-scoped advisory lock is
 * released on commit or rollback and cannot leak across a pooled connection.
 *
 * Must be called INSIDE the transaction that writes the row. Called outside one, the lock is
 * released before the insert and the number it returns is a guess.
 *
 * Numbering starts at 1 per property and has no gaps: a rolled-back check-in rolls back its claim
 * with everything else, which is the behaviour a sequence would NOT give.
 */
export async function claimRegisterNo(
  tx: Prisma.TransactionClient,
  propertyId: string,
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${propertyId}, 0))`;
  const rows = await tx.$queryRaw<{ next: bigint | number | null }[]>`
    SELECT COALESCE(MAX("registerNo"), 0) + 1 AS next
    FROM "StayGuest"
    WHERE "propertyId" = ${propertyId}
  `;
  return Number(rows[0]?.next ?? 1);
}
