import { describe, expect, it } from "vitest";
import { defaultFiscalTaxGroups } from "@revio/core";
import { fiscalPlan, type PlanLine } from "./fiscal-plan";

const G = defaultFiscalTaxGroups(true);
let n = 0;
const at = (min: number) => new Date(Date.UTC(2026, 9, 6, 10, min));
function line(p: Partial<PlanLine> & { kind: string; amountMinor: number }): PlanLine {
  n += 1;
  return {
    id: `l${n}`, folioId: "f1", method: null, taxCategory: null, outlet: null, voided: false,
    postedAt: at(n), fiscalReceiptNo: null, fiscalReceiptData: null, ...p,
  };
}
const room = () => line({ kind: "accommodation", amountMinor: 20000, taxCategory: "reduced", outlet: "room" });
const receiptData = (amountMinor: number) => ({
  items: [{ text: "Нощувки", taxGroup: 4, amountMinor }], paymentType: "cash",
  receiptNumber: "0000085", receiptDateTime: "2026-10-06T10:00:00", fiscalMemorySerialNumber: "DT000001",
});

describe("fiscalPlan — receipts", () => {
  it("a cash or card payment owes a receipt; a bank transfer and an OTA prepayment do not", () => {
    const lines = [room(), line({ kind: "payment", amountMinor: 5000, method: "cash" }), line({ kind: "payment", amountMinor: 5000, method: "card" }),
      line({ kind: "payment", amountMinor: 5000, method: "bank_transfer" }), line({ kind: "payment", amountMinor: 5000, method: "prepaid_ota" })];
    const p = fiscalPlan(lines, "bg", G);
    expect([...p.keys()]).toEqual([lines[1]!.id, lines[2]!.id]);
  });

  it("a held deposit with VAT at capture is an advance: receipted when taken", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", taxCategory: "standard" });
    const e = fiscalPlan([room(), held], "bg", G).get(held.id);
    expect(e?.owes).toBe("receipt");
    if (e?.owes === "receipt") expect(e.receipt.totalMinor).toBe(10000);
  });

  it("a security deposit (VAT at use) is not a sale: no receipt when taken, a receipt when applied — in the method it was taken in", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "card" });
    const use = line({ kind: "deposit_use", amountMinor: 4000, taxCategory: "standard" });
    const p = fiscalPlan([room(), held, use], "bg", G);
    expect(p.has(held.id)).toBe(false);
    const e = p.get(use.id);
    expect(e?.owes).toBe("receipt");
    if (e?.owes === "receipt") { expect(e.receipt.paymentType).toBe("card"); expect(e.receipt.totalMinor).toBe(4000); }
  });

  it("an advance already receipted at capture is never receipted again when applied", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", taxCategory: "standard", fiscalReceiptNo: "0000085" });
    const use = line({ kind: "deposit_use", amountMinor: 10000, taxCategory: "standard" });
    expect(fiscalPlan([room(), held, use], "bg", G).size).toBe(0);
  });

  it("a deposit taken by bank transfer never reaches the device, held or applied", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "bank_transfer" });
    const use = line({ kind: "deposit_use", amountMinor: 10000, taxCategory: "standard" });
    expect(fiscalPlan([room(), held, use], "bg", G).size).toBe(0);
  });

  it("a deposit on another folio of the stay does not decide this folio's receipt", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", folioId: "f2" });
    const use = line({ kind: "deposit_use", amountMinor: 4000 });
    expect(fiscalPlan([room(), held, use], "bg", G).size).toBe(0);
  });

  it("outside Bulgaria nothing is planned", () => {
    expect(fiscalPlan([room(), line({ kind: "payment", amountMinor: 5000, method: "cash" })], "xx", G).size).toBe(0);
  });
});

describe("fiscalPlan — stornos", () => {
  it("a voided receipted payment or deposit owes a storno of the whole receipt, its reason chosen", () => {
    const pay = line({ kind: "payment", amountMinor: 5000, method: "cash", voided: true, fiscalReceiptNo: "1", fiscalReceiptData: receiptData(5000) });
    const held = line({ kind: "deposit_held", amountMinor: 8000, method: "cash", taxCategory: "standard", voided: true, fiscalReceiptNo: "2", fiscalReceiptData: receiptData(8000) });
    const p = fiscalPlan([room(), pay, held], "bg", G);
    for (const id of [pay.id, held.id]) {
      const e = p.get(id);
      expect(e?.owes).toBe("storno");
      if (e?.owes === "storno") expect(e.reasonFixed).toBe(false);
    }
  });

  it("refunding part of a receipted deposit owes a partial storno against that receipt", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", taxCategory: "standard", fiscalReceiptNo: "0000085", fiscalReceiptData: receiptData(10000) });
    const refund = line({ kind: "deposit_refund", amountMinor: 3000, method: "cash" });
    const e = fiscalPlan([room(), held, refund], "bg", G).get(refund.id);
    expect(e?.owes).toBe("storno");
    if (e?.owes === "storno") {
      expect(e.reasonFixed).toBe(true);
      expect(e.original?.receiptNumber).toBe("0000085");
      expect(e.original?.items.reduce((a, i) => a + i.amountMinor, 0)).toBe(3000);
    }
  });

  it("a receipt typed in by hand still owes its storno — printed by hand too", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", taxCategory: "standard", fiscalReceiptNo: "77" });
    const refund = line({ kind: "deposit_refund", amountMinor: 10000, method: "cash" });
    const e = fiscalPlan([room(), held, refund], "bg", G).get(refund.id);
    expect(e).toEqual({ owes: "storno", original: null, reasonFixed: true });
  });

  it("returning a security deposit that was never receipted needs nothing", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash" });
    const refund = line({ kind: "deposit_refund", amountMinor: 10000, method: "cash" });
    expect(fiscalPlan([room(), held, refund], "bg", G).size).toBe(0);
  });

  it("voiding a deposit after part of it went back reverses only what is left", () => {
    const held = line({ kind: "deposit_held", amountMinor: 10000, method: "cash", taxCategory: "standard", voided: true, fiscalReceiptNo: "85", fiscalReceiptData: receiptData(10000) });
    const refund = line({ kind: "deposit_refund", amountMinor: 3000, method: "cash" });
    const e = fiscalPlan([room(), held, refund], "bg", G).get(held.id);
    expect(e?.owes === "storno" && e.original?.items.reduce((a, i) => a + i.amountMinor, 0)).toBe(7000);
    const all = line({ kind: "deposit_refund", amountMinor: 7000, method: "cash" });
    expect(fiscalPlan([room(), held, refund, all], "bg", G).has(held.id)).toBe(false);
  });
});
