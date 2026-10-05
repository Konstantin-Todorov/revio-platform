/**
 * Turn one desk payment into the fiscal receipt the hotel's own device prints.
 *
 * Revio prints through ErpNet.FP on the front-desk PC as ordinary, non-listed software — see
 * `docs/specs/FISCAL-PRINTER.md` and the 2026-10-05 correction in `BG-FISCALIZATION-RESEARCH.md`.
 * This file decides WHAT is printed; it never talks to a device.
 *
 * ## Why the payment, not the folio
 *
 * Н-18 ties the receipt to the money changing hands (чл. 3 ал. 1), so a €50 deposit on a €200 stay is
 * a €50 receipt — not a €200 one and not nothing. Its lines are the stay's charges grouped by tax group
 * and scaled to the payment, so the €50 is split the way the stay is split. The amounts are integer
 * cents allocated by largest remainder: the lines ALWAYS add up to the payment exactly, because a
 * receipt whose total differs from the cash in the drawer is the first thing an inspector checks.
 *
 * Not tax advice. The mapping from tax category to group is property configuration; the defaults are
 * the common reading and the hotel's accountant confirms them.
 */

/** Н-18 tax groups. ErpNet.FP takes them as 1–8 in this order. */
export const FISCAL_TAX_GROUPS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З"] as const;
export type FiscalTaxGroup = (typeof FISCAL_TAX_GROUPS)[number];

/** The folio's tax categories (`FolioLine.taxCategory`). */
export type FolioTaxCategory = "standard" | "reduced" | "city_tax" | "exempt";
export type FiscalTaxGroupMap = Record<FolioTaxCategory, FiscalTaxGroup>;

/**
 * The common Bulgarian reading: 20% → Б, 9% accommodation → Г, tourist tax and exempt → А.
 * A trader NOT registered for VAT prints everything in group А.
 */
export function defaultFiscalTaxGroups(vatRegistered: boolean): FiscalTaxGroupMap {
  if (!vatRegistered) return { standard: "А", reduced: "А", city_tax: "А", exempt: "А" };
  return { standard: "Б", reduced: "Г", city_tax: "А", exempt: "А" };
}

export function taxGroupNumber(g: FiscalTaxGroup): number {
  return FISCAL_TAX_GROUPS.indexOf(g) + 1;
}

export type FiscalChargeLine = {
  amountMinor: number;
  taxCategory: string | null;
  outlet: string | null;
};

export type FiscalReceiptItem = {
  text: string;
  /** Н-18 tax group as ErpNet.FP numbers it (А = 1 … З = 8). */
  taxGroup: number;
  amountMinor: number;
};

/**
 * Integer cents throughout. The conversion to the device's decimal format happens once, at the edge
 * that talks to the printer — never here.
 */
export type FiscalReceipt = {
  items: FiscalReceiptItem[];
  paymentType: "cash" | "card";
  totalMinor: number;
};

/** Receipt lines are short on every device; these fit the narrowest common one (Datecs DP-25, 22 chars). */
const LABEL: Record<string, string> = {
  room: "Нощувки",
  minibar: "Храна и напитки",
  bar: "Храна и напитки",
  restaurant: "Храна и напитки",
  spa: "СПА услуги",
  city_tax: "Туристически данък",
  other: "Допълнителни услуги",
  extra: "Допълнителни услуги",
};
const ADVANCE = "Аванс за нощувки";

function labelFor(line: FiscalChargeLine): string {
  if (line.taxCategory === "city_tax") return LABEL.city_tax!;
  return LABEL[line.outlet ?? "other"] ?? LABEL.other!;
}

function categoryOf(c: string | null): FolioTaxCategory {
  return c === "standard" || c === "reduced" || c === "city_tax" ? c : "exempt";
}

/** Split `total` across `weights` in proportion, exactly, by largest remainder (ties keep order). */
export function allocateExactly(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Build the receipt for one payment.
 *
 * `charges` are the stay's non-voided charge lines (any sign — a discount line reduces its group).
 * A group whose net is not positive is dropped: a receipt cannot carry a negative sale line.
 * When there is nothing positive to scale against — a deposit before any night has been posted — the
 * whole payment prints as an advance for accommodation in the reduced-rate group, which is what a
 * pre-arrival deposit is.
 */
export function buildFiscalReceipt(input: {
  amountMinor: number;
  method: "cash" | "card";
  charges: FiscalChargeLine[];
  groups: FiscalTaxGroupMap;
}): FiscalReceipt {
  const { amountMinor, method, groups } = input;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new Error("A fiscal receipt needs a positive amount in cents.");

  // Net per (tax group, label), in first-seen order so the printout follows the folio.
  const buckets = new Map<string, { text: string; group: FiscalTaxGroup; net: number }>();
  for (const c of input.charges) {
    const group = groups[categoryOf(c.taxCategory)];
    const text = labelFor(c);
    const key = `${group}|${text}`;
    const b = buckets.get(key) ?? { text, group, net: 0 };
    b.net += c.amountMinor;
    buckets.set(key, b);
  }
  const positive = [...buckets.values()].filter((b) => b.net > 0);

  const lines = positive.length
    ? allocateExactly(amountMinor, positive.map((b) => b.net)).map((amt, i) => ({ text: positive[i]!.text, group: positive[i]!.group, amt }))
    : [{ text: ADVANCE, group: groups.reduced, amt: amountMinor }];

  const items = lines
    .filter((l) => l.amt > 0)
    .map((l) => ({ text: l.text, taxGroup: taxGroupNumber(l.group), amountMinor: l.amt }));

  const totalMinor = items.reduce((a, b) => a + b.amountMinor, 0);
  if (totalMinor !== amountMinor) throw new Error(`Receipt lines (${totalMinor}) do not add up to the payment (${amountMinor}).`);
  return { items, paymentType: method, totalMinor };
}
