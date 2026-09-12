import { forSystem } from "./rls.js";
import { canDeleteClient, TENANT_TABLES_WITHOUT_CASCADE, type ClientDeletionVerdict } from "@revio/core";

/**
 * Removing a client, completely and on purpose.
 *
 * ## The two halves that a `tenant.delete()` alone gets wrong
 *
 * **It deletes too little.** The cascade reaches 55 tables. Six carry `tenantId` as a plain column
 * with no foreign key, because the RLS pattern needs the column rather than the constraint — so
 * they survive as rows belonging to a hotel that no longer exists. `ConnectivityCredential` is one
 * of them: encrypted OTA credentials, left in the database forever after the customer has gone.
 * `Invoice` is another. Those are exactly what a deletion is for.
 *
 * **It deletes too much.** A client who stopped paying is not a client to delete — the founder's
 * rule is that they can come back at any time. `canDeleteClient` refuses anything carrying an
 * issued invoice and points at suspension instead.
 *
 * ## What survives on purpose
 *
 * A `DeletedClient` row: the name, when, who pressed it, and what was removed. Everything else about
 * this hotel is gone, so without it nobody could ever answer "what happened to them?" — and the
 * audit trail of a deletion cannot live inside the thing being deleted.
 */

export interface DeleteClientResult {
  ok: boolean;
  message?: string;
  removed?: Record<string, number>;
}

/** The facts the rule needs, read once. Exported so the screen can show the same warning it will enforce. */
export async function clientDeletionFacts(tenantId: string) {
  const prisma = forSystem();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, status: true, isDemo: true, createdAt: true },
  });
  if (!tenant) return null;

  const [issuedInvoices, reservations, properties, users] = await Promise.all([
    // Sent or paid only. A draft is a number nobody has seen.
    prisma.invoice.count({ where: { tenantId, status: { in: ["sent", "paid"] } } }),
    prisma.reservation.count({ where: { tenantId } }),
    prisma.property.count({ where: { tenantId } }),
    prisma.user.count({ where: { tenantId } }),
  ]);

  return {
    tenant,
    facts: {
      issuedInvoices,
      reservations,
      isDemo: tenant.isDemo,
      isPendingSignup: tenant.status === "pending_signup",
      isSuspended: tenant.status === "suspended",
    },
    counts: { reservations, properties, users, issuedInvoices },
  };
}

export async function deleteClientCompletely(args: {
  tenantId: string;
  /** Typed by the operator. Must equal the client's name exactly — see the action for why. */
  confirmation: string;
  operatorUserId: string;
  operatorName: string;
}): Promise<DeleteClientResult> {
  const prisma = forSystem();
  const loaded = await clientDeletionFacts(args.tenantId);
  if (!loaded) return { ok: false, message: "That client no longer exists." };

  const { tenant, facts, counts } = loaded;

  /*
   * ⚠️ Re-checked HERE, not just on the screen.
   *
   * The screen's warning is advice; this is the rule. A page open since before an invoice was sent
   * would otherwise delete a tax record on the strength of a check made minutes ago.
   */
  const verdict: ClientDeletionVerdict = canDeleteClient(facts);
  if (!verdict.ok) return { ok: false, message: `${verdict.reason} ${verdict.instead}` };

  // Typing the name is the only confirmation that cannot be clicked through by muscle memory.
  if (args.confirmation.trim() !== tenant.name.trim()) {
    return { ok: false, message: `Type the client's name exactly — "${tenant.name}" — to confirm.` };
  }

  const removed: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    /*
     * The six the cascade cannot reach, deleted explicitly and BEFORE the tenant.
     *
     * The list lives in `@revio/core` and `client-deletion.db.test.ts` recomputes it from the live
     * constraint graph, so a tenant-scoped table added next month breaks the build instead of
     * quietly leaving rows behind.
     */
    for (const table of TENANT_TABLES_WITHOUT_CASCADE) {
      const n = await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = $1`, args.tenantId);
      if (n > 0) removed[table] = n;
    }

    // Everything else goes with the tenant, through 55 tables of cascade.
    await tx.tenant.delete({ where: { id: args.tenantId } });

    /*
     * Written INSIDE the transaction: a deletion that happened with no record of it, or a record of
     * a deletion that did not happen, are both worse than either succeeding or failing together.
     */
    await tx.deletedClient.create({
      data: {
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        wasDemo: tenant.isDemo,
        lastStatus: tenant.status,
        clientSince: tenant.createdAt,
        reservations: counts.reservations,
        properties: counts.properties,
        users: counts.users,
        deletedByName: args.operatorName,
        deletedById: args.operatorUserId,
      },
    });
  });

  return { ok: true, removed };
}
