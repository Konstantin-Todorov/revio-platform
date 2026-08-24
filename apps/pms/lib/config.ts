import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { formatDocumentNumber, seriesKeyFor, seriesStartFor, type InvoiceNumberScheme } from "@revio/core";

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

  /*
   * The number the NEXT document of each type would carry — formatted, not the raw counter.
   *
   * Under the Bulgarian scheme invoices and credit notes share one range, so both rows show the same
   * value, which is correct and is the point: staff should be able to see that they are one
   * sequence. Showing the bare counter would print "4" beside a document that will actually be
   * numbered 1000000003.
   */
  const scheme = (defaults?.invoiceNumberScheme ?? "bg_10digit") as InvoiceNumberScheme;
  const configuredStart = defaults?.invoiceNumberStart ?? 1000000000n;
  const byKey = new Map(series.map((s) => [s.docType, s.nextNumber]));
  const nextByDoc: Record<string, string> = {};
  for (const docType of ["invoice", "proforma", "credit_note"] as const) {
    const claimed = byKey.get(seriesKeyFor(scheme, docType)) ?? seriesStartFor(scheme, docType, configuredStart);
    nextByDoc[docType] = formatDocumentNumber({ scheme, docType, claimed, year: new Date().getFullYear() });
  }

  return { property, canManage, defaults, depositTypes, nextByDoc, outletCounts };
}
