"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./session";
import { MANAGER_ROLES } from "./roles";
import { logAudit, str } from "./mutation-helpers";

/**
 * Guest merge (PMS-REFINEMENT-R1 §3.5). Collapses a duplicate (loser) onto a survivor (winner):
 * re-parents the loser's reservations + notes to the winner, back-fills any contact field the winner is
 * missing, then flags the loser with mergedIntoId so it drops out of lists/metrics without being deleted
 * (ids stay resolvable). Manager-gated. This is the write half of the identity foundation.
 */
export async function mergeGuests(fd: FormData): Promise<void> {
  const s = await getSession();
  if (!s || !MANAGER_ROLES.has(s.role)) return;

  const winnerId = str(fd, "winnerId");
  const loserId = str(fd, "loserId");
  if (!winnerId || !loserId || winnerId === loserId) return;

  const [winner, loser] = await Promise.all([
    prisma.guest.findFirst({ where: { id: winnerId, propertyId: s.activePropertyId } }),
    prisma.guest.findFirst({ where: { id: loserId, propertyId: s.activePropertyId } }),
  ]);
  if (!winner || !loser || loser.mergedIntoId || winner.mergedIntoId) return;

  // Re-parent the loser's records to the winner.
  await prisma.reservation.updateMany({ where: { guestId: loserId }, data: { guestId: winnerId } });
  await prisma.guestNote.updateMany({ where: { guestId: loserId }, data: { guestId: winnerId } });

  // Back-fill any contact detail the winner is missing (never overwrite existing winner data).
  const fill: Record<string, string> = {};
  if (!winner.email && loser.email) fill.email = loser.email;
  if (!winner.phone && loser.phone) fill.phone = loser.phone;
  if (!winner.company && loser.company) fill.company = loser.company;
  if (Object.keys(fill).length) await prisma.guest.update({ where: { id: winnerId }, data: fill });

  // Flag the loser as merged (soft — not deleted).
  await prisma.guest.update({ where: { id: loserId }, data: { mergedIntoId: winnerId } });

  await logAudit(s.activePropertyId, s.tenantId, {
    entity: "guest",
    field: "merge",
    oldValue: `${loser.firstName} ${loser.lastName} (${loserId.slice(-6)})`,
    newValue: `${winner.firstName} ${winner.lastName} (${winnerId.slice(-6)})`,
    userId: s.userId,
  });

  revalidatePath("/guests");
  revalidatePath(`/guests/${winnerId}`);
  redirect(`/guests/${winnerId}`);
}
