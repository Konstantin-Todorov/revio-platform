import "server-only";
import { cookies } from "next/headers";
import { forSystem } from "@revio/db";
import { readSessionToken, verifySessionToken } from "./auth";

// Identity resolution runs before a tenant context exists, so it bypasses RLS (app.bypass=on).
const prisma = forSystem();

export type Perimeter = "operator" | "hotel";
export type Role = "owner" | "admin" | "revenue_manager" | "distribution_manager" | "read_only";

export interface Session {
  perimeter: Perimeter;
  tenantId: string;
  userId: string;
  userName: string;
  role: Role;
  entitlements: { channelManager: boolean; reservation: boolean; pms: boolean };
  activePropertyId: string;
  tenantName: string;
  /** "group" = portfolio scope (CRS-GUIDE §4.1): Dashboard + Analytics aggregate across every
   * property in the tenant. Operational screens still auto-select `activePropertyId` (the first
   * property). Only reachable when the tenant actually owns more than one property. */
  scope: "property" | "group";
  propertyCount: number;
}

export const ACTIVE_PROPERTY_COOKIE = "revio_property";
/** Sentinel cookie value selecting the whole portfolio instead of one property. */
export const GROUP_SCOPE = "__group__";

/**
 * THE single identity choke point. Resolves the logged-in hotel user → their tenant.
 * Returns null when not authenticated; protected routes redirect to /login.
 */
export async function getSession(): Promise<Session | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload || payload.kind !== "hotel") return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });
  if (!user || !user.active || user.tenant.status !== "active") return null;
  const tenant = user.tenant;

  const properties = await prisma.property.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } });
  if (properties.length === 0) return null;
  const cookieProp = (await cookies()).get(ACTIVE_PROPERTY_COOKIE)?.value;
  // Portfolio scope only makes sense with >1 property; otherwise fall back to the single property.
  const isGroup = cookieProp === GROUP_SCOPE && properties.length > 1;
  const active = isGroup ? properties[0]! : (properties.find((p) => p.id === cookieProp) ?? properties[0]!);

  return {
    perimeter: "hotel",
    tenantId: tenant.id,
    userId: user.id,
    userName: user.name,
    role: (user.role as Role) ?? "owner",
    entitlements: {
      channelManager: tenant.hasChannelManager,
      reservation: tenant.hasReservation,
      pms: tenant.hasPms,
    },
    activePropertyId: active.id,
    tenantName: tenant.name,
    scope: isGroup ? "group" : "property",
    propertyCount: properties.length,
  };
}

/** Properties the signed-in user may switch between — only their own tenant's (a chain's hotels). */
export async function getSwitchableProperties(tenantId: string) {
  return prisma.property.findMany({
    where: { tenantId },
    include: { tenant: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}
