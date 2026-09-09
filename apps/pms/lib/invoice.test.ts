import { beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ defaults: vi.fn(), folio: vi.fn(), create: vi.fn(), tenant: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: {
  propertyDefaults: { findUnique: io.defaults }, folio: { findFirst: io.folio },
  reservationLine: { findFirst: async () => ({ checkOut: new Date("2026-09-09") }) },
  tenant: { findUnique: io.tenant },
} }));
vi.mock("./data", () => ({ activeProperty: async () => ({
  property: { id: "hotel", name: "Hotel", address: "Address" }, session: { tenantId: "tenant" },
}) }));
vi.mock("./fiscal", () => ({ fiscalizeInvoice: async () => null }));
vi.mock("@revio/db", () => ({ withTenantTransaction: async (_tenant: string, fn: (tx: unknown) => Promise<unknown>) => fn({
  invoiceSeries: { findFirst: async () => ({ id: "series", nextNumber: 1000000000n }), update: vi.fn() },
  taxInvoice: { create: io.create },
}) }));
import { computeTaxSummary, generateInvoice } from "./invoice";

const rates = { standard: 20, reduced: 9 };
const line = (taxCategory: string | null, amountMinor: number, kind = "fee", description = "Tourist tax") =>
  ({ kind, taxCategory, amountMinor, voided: false, description, outlet: "room" });

beforeEach(() => {
  vi.clearAllMocks();
  io.defaults.mockResolvedValue(null);
  io.tenant.mockResolvedValue({ isDemo: false });
  io.create.mockResolvedValue({ id: "invoice" });
});

describe("tourist tax in the accommodation VAT base", () => {
  it("combines EUR 192 room + EUR 3 city tax into one inclusive 9% base", () => {
    const summary = computeTaxSummary([line("reduced", 19200, "accommodation"), line("city_tax", 300)], rates);
    expect(summary).toEqual({ rows: [
      { category: "reduced", ratePct: 9, grossMinor: 19500, netMinor: 17890, taxMinor: 1610 },
    ], grossMinor: 19500, netMinor: 17890, taxMinor: 1610 });
  });
  it.each(["exempt", null])("keeps %s at zero in the actual summary, not just rateFor", (category) => {
    const summary = computeTaxSummary([line(category, 1090)], rates);
    expect(summary.taxMinor).toBe(0);
    expect(summary.rows[0]!.ratePct).toBe(0);
    expect(summary.netMinor).toBe(1090);
  });
  it("uses the property's reduced rate rather than hardcoding Bulgarian 9%", () => {
    expect(computeTaxSummary([line("city_tax", 1100)], { standard: 20, reduced: 10 }).taxMinor).toBe(100);
  });
  it("keeps separately sold extras at standard VAT and excludes settlements and voids", () => {
    const summary = computeTaxSummary([
      line("reduced", 10900, "accommodation"), line("city_tax", 109), line("standard", 1200, "extra", "Breakfast"),
      line("standard", 12000, "payment"), line("standard", 5000, "deposit_held"),
      { ...line("city_tax", 999), voided: true },
    ], rates);
    expect(summary.rows.map((r) => [r.ratePct, r.grossMinor, r.taxMinor])).toEqual([[9, 11009, 909], [20, 1200, 200]]);
    expect(summary.grossMinor).toBe(summary.netMinor + summary.taxMinor);
  });
  it("rounds the combined base once, not each separately labelled line", () => {
    expect(computeTaxSummary([line("reduced", 6, "accommodation"), line("city_tax", 6)], rates).taxMinor).toBe(1);
  });
  it("keeps the tourist-tax label/category in the issued line snapshot while aggregating its VAT", async () => {
    const lines = [line("reduced", 19200, "accommodation", "Room"), line("city_tax", 300, "fee", "Туристически данък")];
    io.folio.mockResolvedValue({ id: "folio", currency: "EUR", lines });
    await expect(generateInvoice({ reservationId: "stay", docType: "invoice", buyerName: "Guest" })).resolves.toBe("invoice");
    const data = io.create.mock.calls[0]![0].data;
    expect(data.taxSummary).toHaveLength(1);
    expect(data.taxMinor).toBe(1610);
    expect(data.lineSnapshot).toEqual(lines.map(({ voided: _voided, ...snapshot }) => snapshot));
    expect(lines[1]!.taxCategory).toBe("city_tax");
  });
});
