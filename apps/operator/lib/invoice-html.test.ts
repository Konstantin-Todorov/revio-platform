import { describe, it, expect } from "vitest";
import { esc, money, vatLineLabel, invoiceBodyHtml, invoiceFileHtml, invoiceFileName, type InvoiceDocData } from "./invoice-html";

const base: InvoiceDocData = {
  number: "REV-2026-0001", period: "2026-08",
  issuedAt: new Date("2026-08-24T10:00:00Z"), dueDate: new Date("2026-09-07T10:00:00Z"),
  currency: "EUR",
  issuerName: "Уебър БГ ЕООД", issuerVatId: "BG205090014", issuerCompanyId: "205090014",
  issuerAddress: "Русе, BG", issuerIban: "BG05UNCR70001523246755", issuerBic: "UNCRBGSF",
  issuerBankName: "UniCredit", issuerEmail: "office@reviosoft.app",
  buyerName: "Hotel Sofia Group OOD", buyerVatId: "BG200987654", buyerCompanyId: "200987654",
  buyerAddress: "5 Alabin Street, 1000 Sofia, BG", buyerAttention: "Accounts payable",
  lines: [{ description: "RevioLink", netMinor: 4900 }, { description: "Bundle discount — 20%", netMinor: -3540 }],
  netMinor: 14160, taxMinor: 2832, grossMinor: 16992,
  vatRatePct: 20, vatTreatment: "domestic", vatNote: null, footerNote: "Thank you.",
};

describe("esc", () => {
  it("escapes every character that can break out of markup", () => {
    expect(esc(`<script>alert('x')</script>`)).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(esc(`O"Brien & Sons`)).toBe("O&quot;Brien &amp; Sons");
  });
  it("renders null and undefined as nothing, not as the words", () => {
    // "null" printed where an address should be is worse than a blank line.
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("invoiceBodyHtml", () => {
  it("escapes a company name containing markup", () => {
    // A legal name is typed by a person into a form. This is both the apostrophe-in-O'Brien case and
    // the deliberate one, and the document is emailed to a third party.
    const html = invoiceBodyHtml({ ...base, buyerName: `<img src=x onerror="alert(1)">` });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("keeps non-Latin names intact", () => {
    // Escaping must not mangle Cyrillic — this is a Bulgarian company.
    expect(invoiceBodyHtml(base)).toContain("Уебър БГ ЕООД");
  });

  it("prints the reason a zero-rated line is zero", () => {
    const html = invoiceBodyHtml({
      ...base, vatRatePct: 0, taxMinor: 0, grossMinor: 14160,
      vatTreatment: "eu_reverse_charge", vatNote: "Reverse charge — Art. 196.",
    });
    expect(html).toContain("reverse charge");
    expect(html).toContain("Art. 196");
  });

  it("shows a negative line as a negative, not as a stray minus", () => {
    expect(invoiceBodyHtml(base)).toContain("−€35.40");
  });

  it("falls back to one line rather than an empty table", () => {
    // A table with a header and no rows reads as a broken document.
    const html = invoiceBodyHtml({ ...base, lines: [] });
    expect(html).toContain("Monthly subscription");
  });

  it("omits the payment block entirely when there are no bank details", () => {
    const html = invoiceBodyHtml({ ...base, issuerIban: null, issuerBic: null, issuerBankName: null });
    expect(html).not.toContain("Payment");
  });

  it("labels an unissued draft rather than showing a blank number", () => {
    expect(invoiceBodyHtml({ ...base, number: null })).toContain("not issued");
  });
});

describe("invoiceFileHtml", () => {
  it("is a complete, self-contained document", () => {
    const f = invoiceFileHtml(base);
    expect(f.startsWith("<!doctype html>")).toBe(true);
    expect(f).toContain("<style>");
    expect(f).toContain('<meta charset="utf-8">');
  });

  it("requests nothing from the network — it has to open from a download folder offline", () => {
    const f = invoiceFileHtml(base);
    expect(f).not.toMatch(/<link[^>]+href=/i);
    expect(f).not.toMatch(/<script/i);
    expect(f).not.toMatch(/https?:\/\/[^"']*\.(css|js|woff2?)/i);
  });

  it("titles the tab with the invoice number", () => {
    expect(invoiceFileHtml(base)).toContain("<title>Invoice REV-2026-0001</title>");
  });

  it("stays small enough that storage is a non-question", () => {
    expect(Buffer.byteLength(invoiceFileHtml(base), "utf8")).toBeLessThan(20_000);
  });
});

describe("invoiceFileName", () => {
  it("names the file after the number an accountant files it under", () => {
    expect(invoiceFileName({ number: "REV-2026-0001", period: "2026-08" })).toBe("REV-2026-0001.html");
  });
  it("names a draft as a draft", () => {
    expect(invoiceFileName({ number: null, period: "2026-08" })).toBe("invoice-draft-2026-08.html");
  });
  it("cannot produce a path or break the header it goes into", () => {
    // The stem lands in Content-Disposition. A quote closes the filename early, CR/LF injects a
    // header, a slash suggests a path. The invoice prefix that feeds this is typed into a form.
    for (const n of ['../../etc/passwd"', 'a"; rm -rf /', "x\r\nSet-Cookie: a=b", "....//..//x"]) {
      const f = invoiceFileName({ number: n, period: "2026-08" });
      expect(f).toMatch(/^[A-Za-z0-9._-]+\.html$/);
      expect(f).not.toContain("..");
      expect(f.startsWith(".")).toBe(false);
    }
  });

  it("never returns a bare extension, however hostile the input", () => {
    expect(invoiceFileName({ number: "///", period: "2026-08" })).toBe("invoice.html");
  });
});

describe("money", () => {
  it("always shows two decimals, so a total never reads as a whole number by accident", () => {
    expect(money(14160, "EUR")).toBe("€141.60");
    expect(money(10000, "EUR")).toBe("€100.00");
  });
  it("marks a negative with a real minus sign", () => {
    expect(money(-3540, "EUR")).toBe("−€35.40");
  });
});

describe("vatLineLabel", () => {
  it("never leaves a 0% line unexplained", () => {
    for (const t of ["eu_reverse_charge", "outside_eu", "not_registered"]) {
      expect(vatLineLabel(t, 0)).toMatch(/reverse charge|outside scope|not registered/);
    }
  });
  it("states the rate for a domestic sale", () => {
    expect(vatLineLabel("domestic", 20)).toBe("VAT 20%");
  });
});
