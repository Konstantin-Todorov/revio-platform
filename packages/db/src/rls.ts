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
