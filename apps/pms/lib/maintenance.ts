import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";

/** Maintenance tasks + the active units (for the create form). */
export async function getMaintenanceBoard() {
  const { property } = await activeProperty();
  const [tasks, units] = await Promise.all([
    prisma.maintenanceTask.findMany({
      where: { propertyId: property.id },
      orderBy: [{ createdAt: "desc" }],
      include: { unit: { select: { label: true, roomType: { select: { name: true } } } } },
    }),
    prisma.unit.findMany({ where: { propertyId: property.id, active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true } }),
  ]);
  return { property, tasks, units };
}
