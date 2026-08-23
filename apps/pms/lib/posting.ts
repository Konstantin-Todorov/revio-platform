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

/** Sensible default tax category. Accommodation typically sits at a REDUCED VAT rate (broken out on
 * its own invoice line, spec §4.3); a city-tax fee is its own category; everything else is standard.
 * The rate values behind each category are property config (E7), never hardcoded here. */
function defaultTaxCategory(kind: string, description: string): TaxCategory {
  if (kind === "accommodation") return "reduced";
  if (kind === "fee" && /city\s*tax/i.test(description)) return "city_tax";
  return "standard";
}

/** Money movements, not outlet sales: they carry no outlet tag. */
const MONEY_KINDS = new Set(["payment", "deposit_held", "deposit_use", "deposit_refund"]);

export interface PostChargeInput {
  tenantId: string;
  propertyId: string;
  folioId: string;
  kind: string; // accommodation | minibar | extra | fee | tax | payment | deposit_held | deposit_use | deposit_refund
  description: string;
  amountMinor: number;
  outlet?: Outlet;
  taxCategory?: TaxCategory | null;
  method?: string | null; // payments / deposit captures only
  ref?: string | null;
  depositTypeId?: string | null;
  postedById?: string | null;
}

/** Post ONE line to a folio. Payments + deposit movements carry no outlet; a deposit's tax category
 * comes from its type's VAT timing (spec §4.4) and is passed in by the caller. */
export async function postFolioLine(input: PostChargeInput) {
  return postFolioLineWith(prisma, input);
}

/**
 * The same posting service, against a caller-supplied connection.
 *
 * The automatic Close Day runs from cron with no session, so it cannot use the request-scoped
 * proxy `postFolioLine` reaches for. Rather than give the unattended path its own copy of the
 * posting rules — which is how the two drift until the one nobody watches is the wrong one — the
 * client becomes a parameter and both go through here.
 */
export async function postFolioLineWith(db: typeof prisma, input: PostChargeInput) {
  /*
   * A CLOSED folio takes no more charges.
   *
   * This is the one place every charge goes through (spec §1.7), and it never asked. So anything
   * that posted — the night audit, a minibar tap, a fee — could land money on a bill that had
   * already been closed and, as far as the guest and the hotel were concerned, finished. Production
   * carries four such lines: breakfast accrued onto a folio that closed nine days earlier.
   *
   * It throws rather than returning null, because a charge that silently does not happen is its own
   * kind of wrong: somebody consumed something and nobody billed it. Callers that can legitimately
   * meet a closed folio (the night audit sweeping many stays) check first and skip; a caller that
   * hits this is doing something it should not, and should say so loudly.
   *
   * The way to bill a departed guest is to reopen the folio — a manager action, logged, with the
   * four resolutions on the other side of it.
   */
  const folio = await db.folio.findUnique({
    where: { id: input.folioId },
    select: { status: true },
  });
  if (folio && folio.status !== "open") {
    throw new Error(
      `postFolioLine: refusing to post "${input.description}" to folio ${input.folioId} — it is ${folio.status}. Reopen it first.`,
    );
  }

  const isMoney = MONEY_KINDS.has(input.kind);
  const isPayment = input.kind === "payment";
  return db.folioLine.create({
    data: {
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      folioId: input.folioId,
      kind: input.kind,
      description: input.description,
      amountMinor: input.amountMinor,
      outlet: isMoney ? null : input.outlet ?? defaultOutlet(input.kind),
      taxCategory: isPayment ? null : input.taxCategory !== undefined ? input.taxCategory : defaultTaxCategory(input.kind, input.description),
      method: input.method ?? null,
      ref: input.ref ?? null,
      depositTypeId: input.depositTypeId ?? null,
      postedById: input.postedById ?? null,
    },
  });
}
