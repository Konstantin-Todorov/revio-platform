import { describe, it, expect } from "vitest";
import { ESTI_COLUMNS, estiRow, estiCsv, estiProblems, estiChange, estiFingerprint, estiSubmittedFingerprint, type EstiEntry } from "./esti.js";

const base: EstiEntry = {
  id: "sg_1",
  registerNo: 1,
  registeredAt: "2026-09-03",
  registeredAtTime: "14:20",
  firstName: "Мария",
  middleName: "Петрова",
  lastName: "Иванова",
  personalId: "8001011234",
  dateOfBirth: "1980-01-01",
  sex: "f",
  nationality: "BG",
  documentType: "id_card",
  documentNumber: "641234567",
  documentSeries: null,
  documentCountry: "BG",
  floor: "Floor 2",
  unitLabel: "204",
  arrivalDate: "2026-09-03",
  arrivalTime: "14:20",
  departureDate: "2026-09-06",
  departureTime: null,
  nights: 3,
  touristPackage: false,
  avgNightlyPriceMinor: 6500,
  cancelled: false,
};

describe("ESTI upload file (Описание на интерфейсите, §2)", () => {
  it("has the spec's 19 columns in the spec's order", () => {
    expect(ESTI_COLUMNS).toHaveLength(19);
    expect(ESTI_COLUMNS[0]).toBe("AccomodationPlaceUin");
    expect(ESTI_COLUMNS.at(-1)).toBe("RegistrationTypeCode");
  });

  it("writes the spec's codes and date formats", () => {
    const r = estiRow(base, "NTR-123", "NEW");
    expect(r).toHaveLength(ESTI_COLUMNS.length);
    const col = (name: string) => r[ESTI_COLUMNS.indexOf(name)];
    expect(col("RegistrationDate")).toBe("03.09.2026 14:20");
    expect(col("BirthDate")).toBe("01.01.1980");
    expect(col("GenderTypeCode")).toBe("F");
    expect(col("IdentityDocumentTypeCode")).toBe("ICA");
    expect(col("Floor")).toBe("2");
    expect(col("CheckOutDate")).toBe("06.09.2026 12:00"); // planned departure → property check-out time
    expect(col("TouristPackage")).toBe("FALSE");
    expect(col("AvgNightPrice")).toBe("65.00");
    expect(col("RegistrationTypeCode")).toBe("NEW");
  });

  it("maps a passport to PAS and refuses a document type ЕСТИ does not know", () => {
    expect(estiRow({ ...base, documentType: "passport" }, "U", "NEW")[ESTI_COLUMNS.indexOf("IdentityDocumentTypeCode")]).toBe("PAS");
    expect(estiProblems({ ...base, documentType: "other" }, "U")).toContain("document_type");
  });

  it("requires ЕГН/ЛНЧ of a Bulgarian, and ЛНЧ or a document number of a foreigner", () => {
    expect(estiProblems({ ...base, personalId: null }, "U")).toContain("identity");
    const foreigner = { ...base, nationality: "DE", personalId: null, documentType: "passport" as const, documentNumber: "C01X00T47" };
    expect(estiProblems(foreigner, "U")).not.toContain("identity");
    expect(estiProblems({ ...foreigner, documentNumber: null }, "U")).toContain("identity");
  });

  it("will not build a file without the property's НТР number", () => {
    expect(estiProblems(base, null)).toContain("place_uin");
    expect(estiProblems(base, "NTR-1")).toEqual([]);
  });

  it("decides NEW / UPD / DEL from what ЕСТИ already has", () => {
    expect(estiChange(base, null)).toBe("NEW");
    expect(estiChange({ ...base, cancelled: true }, null)).toBeNull();
    const sent = { fingerprint: estiFingerprint(base) };
    expect(estiChange(base, sent)).toBeNull();
    expect(estiChange({ ...base, unitLabel: "205" }, sent)).toBe("UPD");
    expect(estiChange({ ...base, cancelled: true }, sent)).toBe("DEL");
    const withdrawn = { fingerprint: estiSubmittedFingerprint({ ...base, cancelled: true }, "DEL") };
    expect(estiChange({ ...base, cancelled: true }, withdrawn)).toBeNull();
  });

  it("writes ;-separated UTF-8 with a heading row and quotes what needs it", () => {
    const csv = estiCsv([estiRow({ ...base, lastName: 'O"Neil; Jr' }, "U", "NEW")]);
    expect(csv.startsWith("﻿AccomodationPlaceUin;")).toBe(true);
    expect(csv).toContain('"O""Neil; Jr"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });
});
