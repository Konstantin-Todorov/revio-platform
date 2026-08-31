import { describe, it, expect } from "vitest";
import {
  registerCategory, validateRegisterEntry, isRegisterEntryComplete, registerNights,
  registerRetainedUntil, mayEraseRegisterEntry, EEA_OR_CH,
  type TouristRegisterEntry,
} from "./tourist-register.js";

const base: TouristRegisterEntry = {
  registerNo: 1,
  registeredAt: "2026-09-03",
  fullName: "Мария Петрова Иванова",
  personalId: "8001011234",
  dateOfBirth: "1980-01-01",
  sex: "f",
  nationality: "BG",
  documentNumber: "641234567",
  documentSeries: null,
  documentCountry: "BG",
  unitLabel: "204",
  floor: "2",
  arrivalDate: "2026-09-03",
  departureDate: "2026-09-06",
  nights: 3,
  touristPackage: false,
};

const fieldsOf = (e: TouristRegisterEntry) => validateRegisterEntry(e).map((p) => p.field);

describe("registerCategory — т. 1.1 vs т. 1.2", () => {
  it("puts Bulgaria in the first group", () => {
    expect(registerCategory("BG")).toBe("eea_or_ch");
  });
  it("puts every EU member in the first group", () => {
    for (const c of ["DE", "FR", "IT", "RO", "GR", "SE"]) expect(registerCategory(c)).toBe("eea_or_ch");
  });
  it("puts the non-EU EEA states in the first group — the order names the EEA, not the EU", () => {
    for (const c of ["IS", "LI", "NO"]) expect(registerCategory(c)).toBe("eea_or_ch");
  });
  it("puts Switzerland in the first group — named separately by the order", () => {
    expect(registerCategory("CH")).toBe("eea_or_ch");
  });
  it("puts everyone else in the second", () => {
    for (const c of ["US", "GB", "TR", "RS", "UA", "CN"]) expect(registerCategory(c)).toBe("other");
  });
  it("does not treat the UK as EEA — it left, and the series field turns on this", () => {
    expect(EEA_OR_CH.has("GB")).toBe(false);
  });
  it("is case- and whitespace-insensitive", () => {
    expect(registerCategory(" de ")).toBe("eea_or_ch");
    expect(registerCategory("bg")).toBe("eea_or_ch");
  });
});

describe("validateRegisterEntry", () => {
  it("accepts a complete Bulgarian entry", () => {
    expect(validateRegisterEntry(base)).toEqual([]);
    expect(isRegisterEntryComplete(base)).toBe(true);
  });

  it("requires the document series for a non-EEA citizen, and not for an EEA one", () => {
    const turkish = { ...base, nationality: "TR", personalId: null, documentSeries: null };
    expect(fieldsOf(turkish)).toContain("documentSeries");
    expect(fieldsOf({ ...turkish, documentSeries: "AA" })).not.toContain("documentSeries");

    const german = { ...base, nationality: "DE", personalId: null, documentSeries: null };
    expect(fieldsOf(german)).not.toContain("documentSeries");
  });

  it("requires ЕГН of a Bulgarian and of nobody else", () => {
    expect(fieldsOf({ ...base, personalId: null })).toContain("personalId");
    // A French tourist has no ЕГН to give; demanding one makes the register impossible, not correct.
    expect(fieldsOf({ ...base, nationality: "FR", personalId: null })).not.toContain("personalId");
    expect(fieldsOf({ ...base, nationality: "US", personalId: null, documentSeries: "X" })).not.toContain("personalId");
  });

  it("rejects a one-word name — the register is matched against a passport by hand", () => {
    expect(fieldsOf({ ...base, fullName: "Мария" })).toContain("fullName");
    expect(fieldsOf({ ...base, fullName: "   " })).toContain("fullName");
  });

  it("requires the fields the order lists for both groups", () => {
    expect(fieldsOf({ ...base, sex: null })).toContain("sex");
    expect(fieldsOf({ ...base, dateOfBirth: null })).toContain("dateOfBirth");
    expect(fieldsOf({ ...base, documentNumber: null })).toContain("documentNumber");
    expect(fieldsOf({ ...base, documentCountry: null })).toContain("documentCountry");
    expect(fieldsOf({ ...base, nationality: "" })).toContain("nationality");
  });

  it("requires the room — етаж, стая/апартамент is a register field, not a convenience", () => {
    expect(fieldsOf({ ...base, unitLabel: null })).toContain("unitLabel");
  });

  it("allows a departure date that is not yet known — the guest is still in house", () => {
    expect(validateRegisterEntry({ ...base, departureDate: null, nights: 0 })).toEqual([]);
  });

  it("rejects a departure before arrival", () => {
    expect(fieldsOf({ ...base, departureDate: "2026-09-01" })).toContain("departureDate");
  });

  it("reports every missing field at once, not the first", () => {
    const empty = { ...base, fullName: "", sex: null, dateOfBirth: null, documentNumber: null };
    expect(validateRegisterEntry(empty).length).toBeGreaterThanOrEqual(4);
  });
});

describe("registerNights — брой реализирани нощувки", () => {
  it("counts nights, not days", () => {
    expect(registerNights("2026-09-03", "2026-09-06")).toBe(3);
  });
  it("counts a same-day stay as zero nights, not one", () => {
    // Accommodated, so they belong in the register — but no night was spent, and the tourist tax
    // that is levied per night follows this number.
    expect(registerNights("2026-09-03", "2026-09-03")).toBe(0);
  });
  it("is zero while the guest is still in house", () => {
    expect(registerNights("2026-09-03", null)).toBe(0);
  });
  it("does not go negative on a departure before arrival", () => {
    expect(registerNights("2026-09-06", "2026-09-03")).toBe(0);
  });
  it("crosses a month and a year boundary", () => {
    expect(registerNights("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("is unaffected by a DST change — the dates are UTC-anchored", () => {
    // Europe/Sofia moves on the last Sunday of October; a naive local-time subtraction gives 0.96 days.
    expect(registerNights("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("retention — т. 3, minimum two years", () => {
  it("keeps an entry for two years from registration", () => {
    expect(registerRetainedUntil("2026-09-03")).toBe("2028-09-03");
  });
  it("handles a leap day without landing on an invalid date", () => {
    expect(registerRetainedUntil("2024-02-29")).toBe("2026-03-01");
  });
  it("refuses erasure inside the retention period", () => {
    // The legal obligation outlives the erasure request: GDPR Art. 17(3)(b). The guest PROFILE is
    // anonymised, the register entry stands.
    expect(mayEraseRegisterEntry("2026-09-03", "2027-01-01")).toBe(false);
    expect(mayEraseRegisterEntry("2026-09-03", "2028-09-02")).toBe(false);
  });
  it("permits erasure on and after the retention date", () => {
    expect(mayEraseRegisterEntry("2026-09-03", "2028-09-03")).toBe(true);
    expect(mayEraseRegisterEntry("2026-09-03", "2030-01-01")).toBe(true);
  });
});

describe("countries", () => {
  it("names every EEA/CH code the category check relies on", async () => {
    const { COUNTRY_NAMES } = await import("./countries.js");
    for (const code of EEA_OR_CH) expect(COUNTRY_NAMES[code], code).toBeTruthy();
  });
  it("falls back to the code for a country it does not name", async () => {
    const { countryName } = await import("./countries.js");
    expect(countryName("JP")).toBe("Japan");
    expect(countryName("ZZ")).toBe("ZZ");
    expect(countryName(null)).toBe("—");
  });
  it("normalises typed input and rejects anything that is not two letters", async () => {
    const { normaliseCountryCode } = await import("./countries.js");
    expect(normaliseCountryCode(" bg ")).toBe("BG");
    expect(normaliseCountryCode("Bulgaria")).toBeNull();
    expect(normaliseCountryCode("")).toBeNull();
  });
});
