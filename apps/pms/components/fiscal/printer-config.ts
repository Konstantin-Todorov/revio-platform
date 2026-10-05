/**
 * Which fiscal printer THIS computer prints to. Kept in the browser on purpose: each front desk has
 * its own device on its own PC, so a property-wide setting would send desk 2's receipts to desk 1.
 */
export type FiscalPrinterChoice = { url: string; printerId: string; label: string };

const KEY = "revio.fiscalPrinter";
export const DEFAULT_ERPNET_URL = "http://localhost:8001";

export function readFiscalPrinter(): FiscalPrinterChoice | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as FiscalPrinterChoice | null;
    return v && v.url && v.printerId ? v : null;
  } catch {
    return null;
  }
}

export function writeFiscalPrinter(v: FiscalPrinterChoice | null): void {
  try {
    if (v) window.localStorage.setItem(KEY, JSON.stringify(v));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private window — the choice simply is not remembered */
  }
}
