import "server-only";
import { cache } from "react";
import { forTenant } from "@revio/db";
import { getSession } from "./session";

/**
 * Request-scoped, tenant-isolated Prisma access (same pattern as the CM/CRS apps).
 *
 * Every hotel-facing read/write goes through this `prisma` proxy. It forwards each
 * `prisma.<model>.<op>(args)` call to a Prisma client bound to the current session's tenant, which
 * sets the `app.tenant_id` GUC so Postgres RLS only ever exposes that tenant's rows. Resolving the
 * session is memoised per request via React `cache`, so the scoped client is built once per request.
 *
 * NOTE (gotcha shared with the CRS): this proxy forwards `prisma.<model>.<op>` ONLY — it does NOT
 * forward `$transaction`. Multi-step writes use sequential awaits.
 */
const tenantClient = cache(async () => {
  const session = await getSession();
  if (!session) throw new Error("RLS: no hotel session — cannot scope the database to a tenant.");
  return forTenant(session.tenantId);
});

type Client = ReturnType<typeof forTenant>;

export const prisma = new Proxy({} as Client, {
  get(_target, model: string | symbol) {
    return new Proxy(
      {},
      {
        get(_t2, op: string | symbol) {
          return (...args: unknown[]) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tenantClient().then((client) => (client as any)[model][op](...args));
        },
      },
    );
  },
});
