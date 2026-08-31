import { describe, it, expect } from "vitest";
import {
  registerCategory, validateRegisterEntry, isRegisterEntryComplete, registerNights,
  registerRetainedUntil, mayEraseRegisterEntry, EEA_OR_CH,
  REGISTER_COLUMNS, registerRow, registerToCsv, averageNightlyPrice,
  expectedNameScript, nameScriptMatches, splitName,
  type TouristRegisterEntry,
} from "./tourist-register.js";

const base: TouristRegisterEntry = {
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
  floor: "2",
  unitLabel: "204",
  arrivalDate: "2026-09-03",
  arrivalTime: "14:20",
  departureDate: "2026-09-06",
  departureTime: "10:05",
  nights: 3,
  touristPackage: false,
  avgNightlyPriceMinor: 12000,
  cancelled: false,
};

/** A foreigner: Latin script, no ЕГН, and — outside the EEA — a document series. */
const foreign: TouristRegisterEntry = {
  ...base, firstName: "John", middleName: null, lastName: "Smith",
  personalId: null, nationality: "US", documentType: "passport",
  documentSeries: "AA", documentCountry: "US",
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
    const turkish = { ...foreign, nationality: "TR", documentSeries: null };
    expect(fieldsOf(turkish)).toContain("documentSeries");
    expect(fieldsOf({ ...turkish, documentSeries: "AA" })).not.toContain("documentSeries");

    const german = { ...foreign, nationality: "DE", documentSeries: null };
    expect(fieldsOf(german)).not.toContain("documentSeries");
  });

  it("requires ЕГН of a Bulgarian and of nobody else", () => {
    expect(fieldsOf({ ...base, personalId: null })).toContain("personalId");
    // A French tourist has no ЕГН to give; demanding one makes the register impossible, not correct.
    expect(fieldsOf({ ...foreign, nationality: "FR" })).not.toContain("personalId");
    expect(fieldsOf({ ...foreign, nationality: "US", documentSeries: "X" })).not.toContain("personalId");
  });

  it("requires a first and a family name, but not a patronymic", () => {
    expect(fieldsOf({ ...base, firstName: "" })).toContain("firstName");
    expect(fieldsOf({ ...base, lastName: "  " })).toContain("lastName");
    // Бащино име is a Bulgarian patronymic; most foreigners have none and a blank is correct.
    expect(validateRegisterEntry({ ...foreign, middleName: null })).toEqual([]);
  });

  it("requires the fields the order lists for both groups", () => {
    expect(fieldsOf({ ...base, sex: null })).toContain("sex");
    expect(fieldsOf({ ...base, dateOfBirth: null })).toContain("dateOfBirth");
    expect(fieldsOf({ ...base, documentNumber: null })).toContain("documentNumber");
    expect(fieldsOf({ ...base, documentType: null })).toContain("documentType");
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
    const empty = { ...base, firstName: "", lastName: "", sex: null, dateOfBirth: null, documentNumber: null };
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

describe("name script — the образец's own rule", () => {
  it("expects Cyrillic of a Bulgarian and Latin of everyone else", () => {
    expect(expectedNameScript("BG")).toBe("cyrillic");
    expect(expectedNameScript("DE")).toBe("latin");
  });

  it("flags a Bulgarian written in Latin", () => {
    // A transliteration of the document, not what the document says.
    expect(fieldsOf({ ...base, firstName: "Maria" })).toContain("firstName");
  });

  it("flags a foreigner written in Cyrillic — the rule cuts both ways", () => {
    expect(fieldsOf({ ...foreign, lastName: "Смит" })).toContain("lastName");
  });

  it("accepts each when written correctly", () => {
    expect(validateRegisterEntry(base)).toEqual([]);
    expect(validateRegisterEntry(foreign)).toEqual([]);
  });

  it("treats a blank as fine — the missing-name check owns that, not the script check", () => {
    expect(nameScriptMatches("", "cyrillic")).toBe(true);
    expect(nameScriptMatches("  ", "latin")).toBe(true);
  });

  it("allows hyphens, apostrophes and spaces in either script", () => {
    expect(nameScriptMatches("Anne-Marie O'Brien", "latin")).toBe(true);
    expect(nameScriptMatches("Мария-Тереза", "cyrillic")).toBe(true);
  });
});

describe("cancelled registrations", () => {
  it("are not chased for missing fields", () => {
    // Анулирана регистрация is a closed record of something that did not happen. Left in the
    // incomplete list it would sit there forever.
    const wrong = { ...base, firstName: "", lastName: "", documentNumber: null, cancelled: true };
    expect(validateRegisterEntry(wrong)).toEqual([]);
    expect(isRegisterEntryComplete(wrong)).toBe(true);
  });
});

describe("the официален образец", () => {
  it("has the 23 columns of the template, in its order", () => {
    expect(REGISTER_COLUMNS).toHaveLength(23);
    expect(REGISTER_COLUMNS[0]).toBe("Рег. №");
    expect(REGISTER_COLUMNS[2]).toBe("Час на регистрация");
    expect(REGISTER_COLUMNS[22]).toBe("Анулирана регистрация");
  });

  it("emits one cell per column", () => {
    expect(registerRow(base)).toHaveLength(REGISTER_COLUMNS.length);
  });

  it("writes dates the way a Bulgarian form writes them", () => {
    const r = registerRow(base);
    expect(r[1]).toBe("03.09.2026");
    expect(r[8]).toBe("01.01.1980");
  });

  it("puts the document series ahead of the number, in the one column the образец gives", () => {
    // The заповед asks for "номера и серия" where the template has a single column.
    expect(registerRow(foreign)[11]).toBe("AA 641234567");
    expect(registerRow(base)[11]).toBe("641234567");
  });

  it("writes да/не for the two yes-no columns", () => {
    expect(registerRow({ ...base, touristPackage: true })[20]).toBe("да");
    expect(registerRow(base)[20]).toBe("не");
    expect(registerRow({ ...base, cancelled: true })[22]).toBe("да");
  });

  it("leaves the optional price blank rather than writing a zero", () => {
    // A zero reads as a free night; the column is "незадължително за попълване".
    expect(registerRow({ ...base, avgNightlyPriceMinor: null })[21]).toBe("");
    expect(registerRow(base)[21]).toBe("120.00");
  });

  it("names the document type in Bulgarian", () => {
    expect(registerRow(base)[10]).toBe("Лична карта");
    expect(registerRow(foreign)[10]).toBe("Паспорт");
    expect(registerRow({ ...base, sex: "m" })[9]).toBe("мъж");
  });
});

describe("registerToCsv", () => {
  it("leads with the official headings", () => {
    const csv = registerToCsv([base]);
    expect(csv.split("\r\n")[0]).toBe(REGISTER_COLUMNS.join(";"));
  });

  it("separates on semicolons — a Bulgarian Excel splits on its locale's list separator", () => {
    // A comma-separated file opens there as one column per row, which is the form in which somebody
    // decides the export is broken and goes back to typing.
    expect(registerToCsv([base]).split("\r\n")[1]).toContain(";");
  });

  it("quotes a cell containing the separator, and doubles an embedded quote", () => {
    const odd = { ...base, lastName: "Иванова; Петрова" };
    expect(registerToCsv([odd])).toContain('"Иванова; Петрова"');
    expect(registerToCsv([{ ...base, firstName: 'Ма"рия' }])).toContain('"Ма""рия"');
  });

  it("emits a header even when the register is empty", () => {
    // An empty month is a real answer, and a zero-byte file is not distinguishable from a failure.
    expect(registerToCsv([]).trim()).toBe(REGISTER_COLUMNS.join(";"));
  });
});

describe("averageNightlyPrice", () => {
  it("divides the stay total by its nights", () => {
    expect(averageNightlyPrice(36000, 3)).toBe(12000);
  });
  it("rounds to the minor unit rather than carrying a fraction into the file", () => {
    expect(averageNightlyPrice(10000, 3)).toBe(3333);
  });
  it("is null when nothing is known, and null rather than a division by zero", () => {
    expect(averageNightlyPrice(null, 3)).toBeNull();
    expect(averageNightlyPrice(36000, 0)).toBeNull();
  });
});

describe("splitName — the guess that saves the desk retyping", () => {
  it("splits a Bulgarian three-part name into its three parts", () => {
    expect(splitName("Мария Петрова Иванова")).toEqual({
      firstName: "Мария", middleName: "Петрова", lastName: "Иванова",
    });
  });

  it("splits two words into given and family, with no invented patronymic", () => {
    expect(splitName("John Smith")).toEqual({ firstName: "John", middleName: null, lastName: "Smith" });
  });

  it("keeps a single word as the GIVEN name, not the family one", () => {
    // It is what a channel sends when it only has a first name; putting it in the family column
    // would state a fact rather than leave a blank.
    expect(splitName("Madonna")).toEqual({ firstName: "Madonna", middleName: null, lastName: null });
  });

  it("puts everything between the ends into the patronymic", () => {
    expect(splitName("Jean Paul Marie Dubois").middleName).toBe("Paul Marie");
  });

  it("survives the whitespace a channel actually sends", () => {
    expect(splitName("  John   Smith  ")).toEqual({ firstName: "John", middleName: null, lastName: "Smith" });
    expect(splitName("")).toEqual({ firstName: null, middleName: null, lastName: null });
    expect(splitName("   ")).toEqual({ firstName: null, middleName: null, lastName: null });
  });

  it("is a guess and will be wrong — a two-given-name foreigner gains a patronymic", () => {
    // Recorded rather than fixed: no rule recovers this from one string. The desk corrects it
    // against the document, and an entry cannot be reported until somebody has looked.
    expect(splitName("Anna Maria Rossi").middleName).toBe("Maria");
  });
});
