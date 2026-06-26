import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@revio/db";

export type Perimeter = "operator" | "hotel";
export type Role = "owner" | "admin" | "revenue_manager" | "distribution_manager" | "read_only";

export interface Session {
  perimeter: Perimeter;
  /** null ⇒ operator (all tenants). */
  tenantId: string | null;
  userId: string;
  role: Role;
  entitlements: { channelManager: boolean; reservation: boolean; pms: boolean };
  /** The property currently in view (within the session's tenant). */
  activePropertyId: string;
  tenantName: string;
}

export const ACTIVE_PROPERTY_COOKIE = "revio_property";

/**
 * THE single identity choke point. Every read/write resolves access through here.
 *
 * Dev resolver: the active property comes from a cookie (set by the workspace switcher), defaulting to
 * the first property. Real auth (login/SSO) replaces only this function — nothing downstream changes.
 */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const cookieProp = jar.get(ACTIVE_PROPERTY_COOKIE)?.value;

  const active =
    (cookieProp
      ? await prisma.property.findUnique({ where: { id: cookieProp }, include: { tenant: true } })
      : null) ??
    // Default to the oldest tenant's property (the flagship demo hotel, Hotel Sofia).
    (await prisma.property.findFirst({ include: { tenant: true }, orderBy: { tenant: { createdAt: "asc" } } }));

  if (!active) throw new Error("No property exists — seed the database.");

  const tenant = active.tenant;
  const user =
    (await prisma.user.findFirst({ where: { tenantId: tenant.id, role: "owner" } })) ??
    (await prisma.user.findFirst({ where: { tenantId: tenant.id } }));

  return {
    perimeter: "hotel",
    tenantId: tenant.id,
    userId: user?.id ?? "dev",
    role: (user?.role as Role) ?? "owner",
    entitlements: {
      channelManager: tenant.hasChannelManager,
      reservation: tenant.hasReservation,
      pms: tenant.hasPms,
    },
    activePropertyId: active.id,
    tenantName: tenant.name,
  };
}

/** Properties the workspace switcher may offer. Dev: all properties (labelled by tenant) so isolation
 *  is demonstrable. In production a hotel session only lists its own tenant's properties. */
export async function getSwitchableProperties() {
  return prisma.property.findMany({
    include: { tenant: { select: { name: true } } },
    orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
  });
}
