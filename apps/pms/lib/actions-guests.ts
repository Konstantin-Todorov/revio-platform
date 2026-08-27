"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasChanges, planMerge } from "@revio/core";
import { withTenantTransaction } from "@revio/db";
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
  if (!winnerId || !loserId) return;

  const [winner, loser] = await Promise.all([
    prisma.guest.findFirst({ where: { id: winnerId, propertyId: s.activePropertyId } }),
    prisma.guest.findFirst({ where: { id: loserId, propertyId: s.activePropertyId } }),
  ]);
  if (!winner || !loser) return;

  // The rules live in @revio/core so the CRS decides identically. This used to be a hand-written
  // copy of the same back-fill, which is how two rules drift apart.
  const plan = planMerge(winner, loser);
  if (!plan.ok) return;

  /*
   * ⚠️ ONE transaction, because a half-merge is worse than no merge.
   *
   * This was four sequential awaits, and `forTenant()` wraps each operation in its own transaction —
   * so a failure after the re-parent but before the flag left the loser's reservations attached to
   * the winner while the loser still appeared in every list as a live guest with no history. The
   * hotel then sees two records where one has silently been emptied.
   *
   * See AGENTS.md §1 and the note on withTenantTransaction.
   */
  await withTenantTransaction(s.tenantId, async (tx) => {
    await tx.reservation.updateMany({ where: { guestId: loserId }, data: { guestId: winnerId } });
    await tx.guestNote.updateMany({ where: { guestId: loserId }, data: { guestId: winnerId } });
    if (hasChanges(plan.fill)) {
      await tx.guest.update({ where: { id: winnerId }, data: plan.fill });
    }
    // Last, and inside the same transaction: this is the step that makes the merge visible.
    await tx.guest.update({ where: { id: loserId }, data: { mergedIntoId: winnerId } });
  });

  await logAudit(s.activePropertyId, s.tenantId, {
    entity: "guest",
    field: "merge",
    oldValue: `${plan.describe.loser} (${loserId.slice(-6)})`,
    newValue: `${plan.describe.winner} (${winnerId.slice(-6)})`,
    userId: s.userId,
  });

  revalidatePath("/guests");
  revalidatePath(`/guests/${winnerId}`);
  redirect(`/guests/${winnerId}`);
}
