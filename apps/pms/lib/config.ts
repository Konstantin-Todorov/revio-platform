import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";

/** Everything the Configuration screen (spec §3.10) needs — the property-level setup the E-phase
 * modules depend on, in one place: tax/VAT rates + issuer identity, deposit types, invoice series,
 * outlets, the housekeeping inspection gate, and the jurisdiction/compliance pack. */
export async function getConfiguration() {
  const { session, property } = await activeProperty();
  const canManage = ["owner", "admin", "manager"].includes(session.role);
  const [defaults, depositTypes, series, posItems] = await Promise.all([
    prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
    prisma.depositType.findMany({ where: { propertyId: property.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.invoiceSeries.findMany({ where: { propertyId: property.id } }),
    prisma.posItem.findMany({ where: { propertyId: property.id }, select: { outlet: true, active: true } }),
  ]);

  // Outlet catalog counts.
  const outletCounts = new Map<string, number>();
  for (const i of posItems) if (i.active) outletCounts.set(i.outlet ?? "minibar", (outletCounts.get(i.outlet ?? "minibar") ?? 0) + 1);

  // Next number per doc type (shown read-only so staff can see the series is live).
  const nextByDoc: Record<string, number> = {};
  for (const s of series) nextByDoc[s.docType] = s.nextNumber;

  return { property, canManage, defaults, depositTypes, nextByDoc, outletCounts };
}
