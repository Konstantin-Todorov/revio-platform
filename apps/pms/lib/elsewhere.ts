import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";

/**
 * Is this record at another hotel of the same account? — the question to ask before "not found".
 * RLS keeps it to the tenant; the property is what the workspace switch decides. See `WrongProperty`.
 */
type Elsewhere = { name: string; propertyId: string; propertyName: string } | null;

export async function findGuestElsewhere(guestId: string): Promise<Elsewhere> {
  const { session } = await activeProperty();
  const g = await prisma.guest.findFirst({
    where: { id: guestId, property: { tenantId: session.tenantId } },
    select: { firstName: true, lastName: true, property: { select: { id: true, name: true } } },
  });
  return g ? { name: `${g.firstName} ${g.lastName}`.trim(), propertyId: g.property.id, propertyName: g.property.name } : null;
}

export async function findUnitElsewhere(unitId: string): Promise<Elsewhere> {
  const { session } = await activeProperty();
  const u = await prisma.unit.findFirst({
    where: { id: unitId, property: { tenantId: session.tenantId } },
    select: { label: true, property: { select: { id: true, name: true } } },
  });
  return u ? { name: u.label, propertyId: u.property.id, propertyName: u.property.name } : null;
}
