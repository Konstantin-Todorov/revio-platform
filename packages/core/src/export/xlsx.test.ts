import { describe, it, expect } from "vitest";
import { buildXlsx, cellRef, sanitiseSheetName, crc32, XLSX_CONTENT_TYPE } from "./xlsx.js";

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("cellRef", () => {
  it("numbers the first columns", () => {
    expect(cellRef(0, 0)).toBe("A1");
    expect(cellRef(1, 0)).toBe("B1");
    expect(cellRef(25, 4)).toBe("Z5");
  });
  it("carries into two letters past Z — the register has 23 columns", () => {
    expect(cellRef(26, 0)).toBe("AA1");
    expect(cellRef(27, 0)).toBe("AB1");
    expect(cellRef(51, 0)).toBe("AZ1");
    expect(cellRef(52, 0)).toBe("BA1");
  });
});

describe("sanitiseSheetName", () => {
  it("strips the characters Excel forbids", () => {
    expect(sanitiseSheetName("Rates: 2026/09 [draft]")).toBe("Rates 2026 09 draft");
  });
  it("caps at 31 characters", () => {
    expect(sanitiseSheetName("x".repeat(50))).toHaveLength(31);
  });
  it("never returns an empty name — a nameless sheet will not open", () => {
    expect(sanitiseSheetName("")).toBe("Sheet");
    expect(sanitiseSheetName("///")).toBe("Sheet");
  });
});

describe("crc32", () => {
  it("matches the known value for the standard check input", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("is zero for an empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("buildXlsx", () => {
  const wb = buildXlsx([{ name: "Register", rows: [["Name", "Nights"], ["Мария", 3], ["John", 0]] }]);
  const s = text(wb);

  it("starts with the ZIP local-file signature", () => {
    expect([wb[0], wb[1], wb[2], wb[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("ends with the end-of-central-directory record", () => {
    const tail = wb.slice(-22);
    expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("contains every part a workbook needs to open", () => {
    for (const part of [
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml",
    ]) expect(s, part).toContain(part);
  });

  it("writes numbers as numbers and strings as inline strings", () => {
    // The whole reason this exists instead of a CSV.
    expect(s).toContain("<v>3</v>");
    expect(s).toContain('t="inlineStr"');
  });

  it("writes a zero rather than dropping it", () => {
    // `0` is falsy; an emptiness check written the obvious way loses a real night count.
    expect(s).toContain("<v>0</v>");
  });

  it("carries Cyrillic through", () => {
    expect(s).toContain("Мария");
  });

  it("marks the header row bold and nothing else", () => {
    expect(s).toContain('r="A1" s="1"');
    expect(s).not.toContain('r="A2" s="1"');
  });

  it("escapes XML rather than producing a broken part", () => {
    const x = text(buildXlsx([{ name: "S", rows: [['a & b <c> "d"']] }]));
    expect(x).toContain("a &amp; b &lt;c&gt;");
  });

  it("drops control bytes that would make the whole file unopenable", () => {
    // A stray byte in a guest's name must cost the byte, not the workbook.
    const bad = "bad" + String.fromCharCode(7) + "name";
    const x = text(buildXlsx([{ name: "S", rows: [[bad]] }]));
    expect(x).toContain("badname");
    // Asserted against the WORKSHEET only, not the whole file: 0x07 occurs freely in the ZIP's
    // binary CRCs and offsets, so scanning the decoded archive proves nothing either way.
    const sheet = x.slice(x.indexOf("<worksheet"), x.indexOf("</worksheet>"));
    expect(sheet).not.toContain(String.fromCharCode(7));
  });

  it("produces an openable file from no rows at all", () => {
    // An empty month is a real answer; a corrupt file is not.
    const empty = text(buildXlsx([]));
    expect(empty).toContain("xl/worksheets/sheet1.xml");
    expect(empty).toContain("<sheetData></sheetData>");
  });

  it("writes several sheets with their own relationships", () => {
    const two = text(buildXlsx([{ name: "One", rows: [["a"]] }, { name: "Two", rows: [["b"]] }]));
    expect(two).toContain("xl/worksheets/sheet2.xml");
    expect(two).toContain('sheetId="2"');
    expect(two).toContain('Id="rId3"'); // styles, numbered after the two sheets
  });

  it("is byte-identical across two builds of the same data", () => {
    // The DOS timestamp is fixed for exactly this: otherwise nothing here is diffable or testable.
    expect(Array.from(buildXlsx([{ name: "S", rows: [["a", 1]] }])))
      .toEqual(Array.from(buildXlsx([{ name: "S", rows: [["a", 1]] }])));
  });

  it("declares the content type Excel expects", () => {
    expect(XLSX_CONTENT_TYPE).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
});
