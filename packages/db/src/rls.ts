import { Prisma } from "@prisma/client";
import { prisma } from "./client.js";

/**
 * Row-Level Security clients.
 *
 * The Postgres migration enables `FORCE ROW LEVEL SECURITY` on every tenant-owned table with a
 * `tenant_isolation` policy that reads two transaction-local GUCs:
 *   - `app.tenant_id` — the current tenant; rows are visible only when `tenantId` matches it.
 *   - `app.bypass`    — when `'on'`, the policy passes for every row (operator / system perimeter).
 * With neither set, a connection sees NOTHING (fail-closed) — so every query must go through one of
 * the scoped clients below, which set the GUC transaction-locally (safe under connection pooling).
 *
 * Each model operation is wrapped in a one-statement-prefixed transaction:
 *   SELECT set_config('app.tenant_id', $id, true);  -- `true` = LOCAL, reset at txn end
 *   <the actual query>
 * This is the canonical Prisma RLS pattern; `set_config(..., true)` is the SQL form of `SET LOCAL`.
 *
 * That per-operation wrapping is also the reason `withTenantTransaction` below has to exist: because
 * every op is already its own transaction, a caller doing several awaits in a row gets several
 * transactions, and a failure halfway leaves the earlier writes committed. See its own comment.
 */

type Mode = { kind: "tenant"; tenantId: string } | { kind: "bypass" };

function scoped(mode: Mode) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const setGuc =
            mode.kind === "bypass"
              ? prisma.$executeRaw`SELECT set_config('app.bypass', 'on', true)`
              : prisma.$executeRaw`SELECT set_config('app.tenant_id', ${mode.tenantId}, true)`;
          const [, result] = await prisma.$transaction([setGuc, query(args)]);
          return result;
        },
      },
    },
  });
}

/** Tenant perimeter: only this tenant's rows are visible/writable. Use for all hotel-facing access. */
export function forTenant(tenantId: string) {
  return scoped({ kind: "tenant", tenantId });
}

/**
 * System/operator perimeter: bypasses tenant isolation (sees & writes across all tenants). Use for the
 * Operator Console, for identity resolution that runs before a tenant context exists (session/login),
 * and for cross-tenant maintenance. Never expose this to a hotel request path.
 */
export function forSystem() {
  return scoped({ kind: "bypass" });
}

/** The client handed to a `withTenantTransaction` callback: a Prisma tx client, GUC already set. */
export type TenantTx = Prisma.TransactionClient;

export interface TxOptions {
  /** Max ms the callback may run before Postgres rolls it back. Prisma's default of 5s is short for a
   *  multi-write business operation, so this defaults to 15s. Keep it as low as the work allows: the
   *  transaction holds row locks for its whole life. */
  timeout?: number;
  /** Max ms to wait for a free connection from the pool before giving up. */
  maxWait?: number;
}

/**
 * Run several writes as ONE transaction, with tenant isolation intact.
 *
 * **Why this exists.** `forTenant()` returns a client that wraps every *individual* operation in its
 * own transaction (it has to — the `app.tenant_id` GUC is transaction-local, which is what makes it
 * safe under connection pooling). The consequence is that a multi-step write done as sequential
 * awaits is several transactions, and a failure partway through leaves the earlier steps committed.
 * That is not a hypothetical: it is how a PMS checkout came to close a folio while leaving its
 * reservation in-house, which then accrued nightly charges against a departed guest for 41 nights.
 *
 * So: any business operation whose steps must all land or none of them may — checkout, room move,
 * close day — goes through here instead of a run of awaits.
 *
 *     await withTenantTransaction(session.tenantId, async (tx) => {
 *       await tx.roomAssignment.update(...);
 *       await tx.reservation.update(...);
 *       await tx.folio.updateMany(...);
 *     });
 *
 * **The callback's client is scoped, despite looking unscoped.** `tx` is a plain Prisma transaction
 * client, not one of the extended clients above — deliberately, because an extended client would try
 * to open its own transaction per operation and fail inside this one. Isolation instead comes from
 * setting the GUC as the transaction's first statement: every subsequent statement runs on the same
 * connection inside the same transaction, so the policy sees it. `rls-verify` proves this rather than
 * assuming it, including that a rollback leaves nothing behind.
 *
 * **Do not `catch` inside the callback and continue.** Throwing is what rolls the transaction back;
 * swallowing an error and carrying on re-creates the partial commit this function exists to prevent.
 */
export function withTenantTransaction<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  return runInTransaction({ kind: "tenant", tenantId }, fn, options);
}

/**
 * The system-perimeter counterpart of `withTenantTransaction`: one transaction that spans tenants.
 * Same all-or-nothing guarantee, same rules. Operator/maintenance paths only — never a hotel request.
 */
export function withSystemTransaction<T>(
  fn: (tx: TenantTx) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  return runInTransaction({ kind: "bypass" }, fn, options);
}

function runInTransaction<T>(mode: Mode, fn: (tx: TenantTx) => Promise<T>, options: TxOptions) {
  return prisma.$transaction(
    async (tx) => {
      // First statement in the transaction, so every statement after it is covered. `true` = LOCAL:
      // Postgres resets it when the transaction ends, however it ends, so nothing leaks to the next
      // user of this pooled connection.
      if (mode.kind === "bypass") {
        await tx.$executeRaw`SELECT set_config('app.bypass', 'on', true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${mode.tenantId}, true)`;
      }
      return fn(tx);
    },
    { timeout: options.timeout ?? 15_000, maxWait: options.maxWait ?? 5_000 },
  );
}
