import "server-only";
import { prisma } from "./db";

/**
 * THE charge-posting service (spec §1.7 + §4.2) — the most important architectural rule in the PMS.
 * EVERY folio line (room, city tax, minibar, spa, bar, restaurant, extras, payments) goes through
 * here, never written to FolioLine directly by a screen. Each caller — the folio's post-a-charge,
 * native outlet/POS screens, room/tax seeding, and a future external POS via API — becomes just
 * another caller, and every charge lands tagged with its outlet + tax category so the invoice (§4.3)
 * can break out "Spa — massage" from "Accommodation" and summarise tax per rate.
 */

export const OUTLETS = ["room", "minibar", "extra", "spa", "bar", "restaurant", "other"] as const;
export type Outlet = (typeof OUTLETS)[number];

export const OUTLET_LABEL: Record<string, string> = {
  room: "Room", minibar: "Minibar", extra: "Extra", spa: "Spa", bar: "Bar", restaurant: "Restaurant", other: "Other",
};

export const TAX_CATEGORIES = ["standard", "reduced", "city_tax", "exempt"] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export const TAX_LABEL: Record<string, string> = {
  standard: "Standard VAT", reduced: "Reduced VAT", city_tax: "City tax", exempt: "Exempt",
};

/** Sensible default outlet for a folio-line kind when the caller doesn't specify one. */
function defaultOutlet(kind: string): Outlet {
  if (kind === "accommodation") return "room";
  if (kind === "minibar") return "minibar";
  return "extra"; // extra / fee / tax
}

/** Sensible default tax category. Accommodation carries the property VAT (default standard — the
 * configurable rate/label lands with Configuration in E7); a city-tax fee is its own category. */
function defaultTaxCategory(kind: string, description: string): TaxCategory {
  if (kind === "fee" && /city\s*tax/i.test(description)) return "city_tax";
  return "standard";
}

export interface PostChargeInput {
  tenantId: string;
  propertyId: string;
  folioId: string;
  kind: string; // accommodation | minibar | extra | fee | tax | payment
  description: string;
  amountMinor: number;
  outlet?: Outlet;
  taxCategory?: TaxCategory;
  method?: string | null; // payments only
  ref?: string | null;
  postedById?: string | null;
}

/** Post ONE line to a folio. Payments carry no outlet/tax; every other kind is tagged. */
export async function postFolioLine(input: PostChargeInput) {
  const isPayment = input.kind === "payment";
  return prisma.folioLine.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      kind: input.kind,
      description: input.description,
      amountMinor: input.amountMinor,
      outlet: isPayment ? null : input.outlet ?? defaultOutlet(input.kind),
      taxCategory: isPayment ? null : input.taxCategory ?? defaultTaxCategory(input.kind, input.description),
      method: input.method ?? null,
      ref: input.ref ?? null,
      postedById: input.postedById ?? null,
    },
  });
}
