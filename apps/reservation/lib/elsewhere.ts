import "server-only";
import { prisma } from "./db";

/**
 * Is this record at another hotel of the same account? — asked before answering "not found".
 * The request client is tenant-scoped (RLS), so only the account's own hotels can answer.
 */
type Elsewhere = { name: string; propertyId: string; propertyName: string } | null;

export async function findReservationElsewhere(id: string): Promise<Elsewhere> {
  const r = await prisma.reservation.findFirst({
    where: { id }, select: { guestName: true, property: { select: { id: true, name: true } } },
  });
  return r ? { name: r.guestName, propertyId: r.property.id, propertyName: r.property.name } : null;
}

export async function findGuestElsewhere(id: string): Promise<Elsewhere> {
  const g = await prisma.guest.findFirst({
    where: { id }, select: { firstName: true, lastName: true, property: { select: { id: true, name: true } } },
  });
  return g ? { name: `${g.firstName} ${g.lastName}`.trim(), propertyId: g.property.id, propertyName: g.property.name } : null;
}
