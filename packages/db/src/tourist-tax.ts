import { isCityTax } from "@revio/core";
import type { TenantTx, forTenant } from "./rls.js";

/**
 * The tourist tax rate — ONE number per property, read and written only here.
 *
 * It used to live in two places that never met: RevioCRS's `TaxFee` "City tax" row (what the guest is
 * charged, on the booking page and the folio) and RevioPMS's `PropertyDefaults.touristTaxRateMinor`
 * (what the register says the council is owed). The demo hotel charged its guests 1.50 and told
 * itself it owed 1.00. A hotel can now set the rate on whichever screen its products have — RevioPMS
 * Configuration → Taxes, RevioCRS Settings → Taxes, or first-run setup in either — and every one of
 * them edits this same row:
 *
 *   - RevioPMS only: Configuration → Taxes (the guest is charged on the folio; the register reads it).
 *   - RevioCRS only: Settings → Taxes (the booking page and emails charge it; there is no register).
 *   - Both: one row, so the two can no longer disagree.
 *   - RevioLink only: nothing to set — Revio bills no guest and keeps no register; the OTAs collect.
 *
 * Whether the guest pays it on top or it is already in the price is `PropertyDefaults.cityTaxMode`,
 * a separate fact about the SAME tax — the rate is owed to the council either way.
 *
 * The rate is by law per нощувка (ЗМДТ чл. 61р–61с), so the row is always `per_person_night`; a row
 * from before 2026-10-06 may still say `per_person`, and writing through here corrects it.
 */

type Scoped = ReturnType<typeof forTenant>;
type FeeRow = { id: string; name: string; amountMinor: number | null; basis: string; inclusion: string };
const PERSON_BASES = ["per_person_night", "per_person"];

const query = (propertyId: string) => ({
  where: { propertyId, active: true, type: "fixed", basis: { in: PERSON_BASES } },
  select: { id: true, name: true, amountMinor: true, basis: true, inclusion: true },
});

/** Which of a property's fixed per-person fees is the tourist tax: the one named as such first. */
export function pickTouristTaxFee<T extends Pick<FeeRow, "name" | "basis">>(rows: T[]): T | null {
  const rank = (r: Pick<FeeRow, "name" | "basis">) => (isCityTax(r.name) ? 0 : 2) + (r.basis === "per_person_night" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** The property's tourist tax row, read through a tenant-scoped client. */
export async function findTouristTaxFee(db: Scoped, propertyId: string): Promise<FeeRow | null> {
  return pickTouristTaxFee(await db.taxFee.findMany(query(propertyId)));
}

/** The rate per person per night in minor units, or null when the hotel has not stated one. */
export async function readTouristTaxMinor(db: Scoped, propertyId: string): Promise<number | null> {
  return (await findTouristTaxFee(db, propertyId))?.amountMinor ?? null;
}

/**
 * Set or clear the rate, inside the caller's transaction so it commits with whatever else the screen
 * saved. Cleared → the row is deactivated, never deleted: a fee already on a folio must keep existing
 * for that folio to explain itself.
 */
export async function writeTouristTax(
  tx: TenantTx,
  scope: { tenantId: string; propertyId: string },
  amountMinor: number | null,
): Promise<void> {
  const existing = pickTouristTaxFee(await tx.taxFee.findMany(query(scope.propertyId)));
  if (amountMinor != null && amountMinor > 0) {
    if (existing) {
      await tx.taxFee.update({ where: { id: existing.id }, data: { amountMinor, basis: "per_person_night" } });
    } else {
      await tx.taxFee.create({
        data: {
          tenantId: scope.tenantId, propertyId: scope.propertyId, name: "City tax",
          type: "fixed", amountMinor, basis: "per_person_night", inclusion: "excluded",
        },
      });
    }
  } else if (existing) {
    await tx.taxFee.update({ where: { id: existing.id }, data: { active: false } });
  }
}
