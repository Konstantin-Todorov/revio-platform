import { nightsBetween } from "../stays/calendar.js";

/**
 * The register of accommodated tourists — регистър на настанените туристи.
 *
 * Source: Заповед № Т-РД-14-10 / 11.06.2019 of the Minister of Tourism, issued under чл. 116 ал. 1
 * от Закона за туризма. The field list below is that order's, read from the order itself rather
 * than from a summary — the last Bulgarian requirement this codebase encoded from memory was wrong
 * for a month, and the correction is recorded in `docs/specs/BG-FISCALIZATION-RESEARCH.md`.
 *
 * Keeping this register has been compulsory for every accommodation provider since 1 October 2019,
 * and class A names вили explicitly, so a villa is in scope exactly as a hotel is.
 *
 * WHAT THIS IS NOT: a fiscal device. A guest register records who slept where; it does not report a
 * sale to НАП, and building it does not make this software СУПТО. The two are unrelated obligations
 * and are deliberately kept apart — see `fiscal/receipt-requirement.ts`.
 */

/**
 * The order splits the register in two by the tourist's citizenship (т. 1.1 vs т. 1.2).
 *
 * т. 1.1 covers citizens of Bulgaria, of an EU member state, of a state party to the EEA agreement,
 * and of the Swiss Confederation. т. 1.2 covers everyone else, and asks for one thing more: the
 * SERIES of the identity document as well as its number.
 */
export type RegisterCategory = "eea_or_ch" | "other";

/** EU-27 + the three EEA states that are not EU members + Switzerland. ISO 3166-1 alpha-2. */
export const EEA_OR_CH: ReadonlySet<string> = new Set([
  // EU-27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA, non-EU
  "IS", "LI", "NO",
  // Confederation of Switzerland
  "CH",
]);

export function registerCategory(nationality: string): RegisterCategory {
  return EEA_OR_CH.has(nationality.trim().toUpperCase()) ? "eea_or_ch" : "other";
}

export type Sex = "m" | "f";

/**
 * One row of the register — one accommodated person, one stay.
 *
 * The field names map one-to-one onto the order's list and are commented with the Bulgarian so the
 * mapping can be checked against the source without translating back.
 */
export interface TouristRegisterEntry {
  /** Рег. № — sequential within the property, never reused. */
  registerNo: number;
  /** Дата и час на регистрация — the образец has these as two columns off one instant. */
  registeredAt: string;
  registeredAtTime: string;

  /**
   * Име / Бащино име / Фамилно име, as three columns.
   *
   * The образец is explicit about the script: "за български граждани - на кирилица, за чужденци -
   * на латиница, съгласно националния документ". Both halves matter — a Bulgarian written in Latin
   * and a foreigner written in Cyrillic are each a transliteration of a document rather than what
   * the document says.
   *
   * Бащино име is a Bulgarian patronymic. Most foreigners have none, and a blank is correct there
   * rather than a middle name invented to fill the column.
   */
  firstName: string;
  middleName: string | null;
  lastName: string;

  /** ЕГН / ЛНЧ. */
  personalId: string | null;
  /** Дата на раждане. ISO `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  /** Пол. */
  sex: Sex | null;
  /** Гражданство. ISO 3166-1 alpha-2. */
  nationality: string;

  /** Тип на документ за самоличност. */
  documentType: DocumentType | null;
  /** Номер на лична карта / валиден национален документ за самоличност. */
  documentNumber: string | null;
  /**
   * Серия на документа. The образец has no column for it, but т. 1.2 of the заповед asks for
   * "номера и серия" — so it is captured separately and printed ahead of the number in the one
   * column the образец provides.
   */
  documentSeries: string | null;
  /** Държава, издала националния документ. ISO 3166-1 alpha-2. */
  documentCountry: string | null;

  /** Етаж and Стая/апартамент — two columns in the образец. */
  floor: string | null;
  unitLabel: string | null;

  /** Дата и час на пристигане. The time is blank until the guest is actually checked in. */
  arrivalDate: string;
  arrivalTime: string | null;
  /** Дата и час на отпътуване. Null while the guest is still in house. */
  departureDate: string | null;
  departureTime: string | null;

  /** Брой на реализирани нощувки. */
  nights: number;
  /** Ползване на туристически пакет (да/не). */
  touristPackage: boolean;
  /** Средна цена на нощувка — "незадължително за попълване" on the образец. Minor units. */
  avgNightlyPriceMinor: number | null;
  /**
   * Анулирана регистрация.
   *
   * The образец has a column for it, which is the answer to what to do with a registration made in
   * error: it is cancelled in place, never deleted. A register whose numbering has holes cannot be
   * shown to have had none.
   */
  cancelled: boolean;
}

/** Тип на документ за самоличност. */
export type DocumentType = "id_card" | "passport" | "other";

export const DOCUMENT_TYPE_BG: Readonly<Record<DocumentType, string>> = {
  id_card: "Лична карта",
  passport: "Паспорт",
  other: "Друг документ за самоличност",
};

export const SEX_BG: Readonly<Record<Sex, string>> = { m: "мъж", f: "жена" };

/**
 * Which script the образец expects this person's name in.
 *
 * Bulgarian citizens are written in Cyrillic; everyone else in Latin, as their national document
 * writes them.
 */
export function expectedNameScript(nationality: string): "cyrillic" | "latin" {
  return nationality.trim().toUpperCase() === "BG" ? "cyrillic" : "latin";
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;

/** True when the name is written in the script the образец asks for. Blank counts as fine. */
export function nameScriptMatches(name: string, script: "cyrillic" | "latin"): boolean {
  if (name.trim() === "") return true;
  return script === "cyrillic" ? !LATIN.test(name) && CYRILLIC.test(name) : !CYRILLIC.test(name);
}

export interface RegisterProblem {
  field: keyof TouristRegisterEntry;
  /** Shown to the receptionist, so it says what to do rather than what is wrong. */
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What must be filled in before an entry can be reported.
 *
 * Deliberately NOT a check-in blocker. A guest standing at the desk at 23:00 with a colleague still
 * parking is checked in; the register is completed after. What this drives is the "not ready to
 * report" list, so nothing is discovered on the day the export is due.
 */
export function validateRegisterEntry(e: TouristRegisterEntry): RegisterProblem[] {
  const p: RegisterProblem[] = [];
  const blank = (v: string | null | undefined) => v == null || v.trim() === "";

  // A cancelled registration is not an incomplete one. It is a closed record of something that did
  // not happen, and chasing its blanks would put it on the "not ready to report" list forever.
  if (e.cancelled) return p;

  if (e.registerNo < 1 || !Number.isInteger(e.registerNo)) {
    p.push({ field: "registerNo", message: "The register number is missing." });
  }
  if (!ISO_DATE.test(e.registeredAt)) {
    p.push({ field: "registeredAt", message: "The registration date is missing." });
  }

  if (blank(e.firstName)) p.push({ field: "firstName", message: "First name is required." });
  if (blank(e.lastName)) p.push({ field: "lastName", message: "Family name is required." });

  if (blank(e.nationality)) {
    p.push({ field: "nationality", message: "Citizenship is required." });
  } else {
    /*
     * The script rule, from the образец itself: Bulgarians in Cyrillic, foreigners in Latin, as the
     * national document writes them. Reported per name so it is obvious which one to retype — and
     * it fires in both directions, because a Bulgarian entered as "Ivanov" is as much a
     * transliteration as a German entered as "Мюлер".
     */
    const script = expectedNameScript(e.nationality);
    const say = script === "cyrillic"
      ? "A Bulgarian citizen's name goes in Cyrillic, as the document writes it."
      : "A foreign citizen's name goes in Latin, as the passport writes it.";
    if (!nameScriptMatches(e.firstName, script)) p.push({ field: "firstName", message: say });
    if (!nameScriptMatches(e.middleName ?? "", script)) p.push({ field: "middleName", message: say });
    if (!nameScriptMatches(e.lastName, script)) p.push({ field: "lastName", message: say });
  }

  if (e.sex == null) p.push({ field: "sex", message: "Sex is required." });
  if (blank(e.dateOfBirth) || !ISO_DATE.test(e.dateOfBirth!)) {
    p.push({ field: "dateOfBirth", message: "Date of birth is required." });
  }
  if (e.documentType == null) {
    p.push({ field: "documentType", message: "Say which kind of document this is." });
  }
  if (blank(e.documentNumber)) {
    p.push({ field: "documentNumber", message: "Identity document number is required." });
  }
  if (blank(e.documentCountry)) {
    p.push({ field: "documentCountry", message: "The country that issued the document is required." });
  }
  if (blank(e.unitLabel)) {
    p.push({ field: "unitLabel", message: "Assign a room — the register records which one the guest slept in." });
  }
  if (!ISO_DATE.test(e.arrivalDate)) {
    p.push({ field: "arrivalDate", message: "Arrival date is missing." });
  }

  const cat = registerCategory(e.nationality);
  if (cat === "other" && blank(e.documentSeries)) {
    // т. 1.2 asks for "номера И серия"; т. 1.1 asks for the number alone.
    p.push({ field: "documentSeries", message: "For a non-EU/EEA citizen the register needs the document series as well as its number." });
  }
  /*
   * ЕГН is required of a Bulgarian citizen and of nobody else.
   *
   * Both halves of the заповед list a personal identification number, but only a Bulgarian citizen
   * certainly has one — a French tourist has no ЕГН to give, and refusing their entry for the lack
   * of it would make the register impossible to complete rather than more correct. So: demanded
   * where it always exists, captured where it sometimes does.
   */
  if (e.nationality.trim().toUpperCase() === "BG" && blank(e.personalId)) {
    p.push({ field: "personalId", message: "ЕГН is required for a Bulgarian citizen." });
  }

  if (e.departureDate != null) {
    if (!ISO_DATE.test(e.departureDate)) {
      p.push({ field: "departureDate", message: "Departure date is not a valid date." });
    } else if (e.departureDate < e.arrivalDate) {
      p.push({ field: "departureDate", message: "Departure is before arrival." });
    }
  }
  return p;
}

/** True when the entry has everything the order asks for. */
export function isRegisterEntryComplete(e: TouristRegisterEntry): boolean {
  return validateRegisterEntry(e).length === 0;
}

/**
 * Брой реализирани нощувки — nights actually spent.
 *
 * Delegates to `nightsBetween` in `stays/calendar` rather than repeating the arithmetic: the number
 * on the register and the number on the folio must agree, and two implementations of "how many
 * nights" is how they stop agreeing.
 *
 * A same-day arrival and departure is zero nights, not one. Someone who takes a room for the
 * afternoon has been accommodated and belongs in the register, but no night was spent — and the
 * tourist tax levied per night follows this number.
 */
export function registerNights(arrivalDate: string, departureDate: string | null): number {
  if (departureDate == null) return 0;
  return nightsBetween(arrivalDate, departureDate);
}

/**
 * How long the register must be kept — т. 3 of the order: "минимум 2 (две) години".
 *
 * This outlives a guest's right to erasure, and the conflict is real rather than theoretical: GDPR
 * Art. 17(3)(b) does not require erasure where processing is necessary for compliance with a legal
 * obligation, and this is one. So an erasure request anonymises the guest PROFILE while the
 * register entry stands until its retention expires. `guests/erasure.ts` owns the profile side; this
 * function is what tells it to leave the register alone.
 */
export function registerRetainedUntil(registeredAt: string): string {
  const d = new Date(`${registeredAt}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

export function mayEraseRegisterEntry(registeredAt: string, today: string): boolean {
  return today >= registerRetainedUntil(registeredAt);
}

/**
 * The official column headings, in the official order.
 *
 * Transcribed from **Образец на регистър за настанените туристи** as published by the Ministry of
 * Tourism alongside the заповед. The order is the образец's, not ours, and it is not ours to tidy:
 * this file is opened by somebody who compares it against the template.
 *
 * Note what the образец asks for that the заповед's prose does not: the TIME of registration,
 * arrival and departure; the document TYPE; the name in three parts; an average nightly price
 * (optional); and a cancellation flag.
 */
export const REGISTER_COLUMNS: readonly string[] = [
  "Рег. №",
  "Дата на регистрация",
  "Час на регистрация",
  "ЕГН / ЛНЧ",
  "Гражданство",
  "Име на лицето",
  "Бащино име на лицето",
  "Фамилно име на лицето",
  "Дата на раждане",
  "Пол",
  "Тип на документ за самоличност",
  "Номер на лична карта/валиден национален документ за самоличност",
  "Държава, издала националния документ",
  "Етаж",
  "Стая/апартамент",
  "Дата на пристигане",
  "Час на пристигане",
  "Дата на отпътуване",
  "Час на отпътуване",
  "Брой на реализирани нощувки",
  "Ползване на туристически пакет (да/не)",
  "Средна цена на нощувка",
  "Анулирана регистрация",
];

/** `2026-09-03` → `03.09.2026`, the way a Bulgarian form writes a date. */
function bgDate(iso: string | null): string {
  if (!iso || !ISO_DATE.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const yesNo = (v: boolean) => (v ? "да" : "не");

/**
 * One entry as the образец's row — 23 cells, aligned to `REGISTER_COLUMNS`.
 *
 * Everything is rendered as text on purpose. This file is opened in Excel, where an identity
 * document number like `0641234567` becomes `641234567` the moment the column is treated as a
 * number, and a date becomes whatever the machine's locale prefers. The register is a document, not
 * a spreadsheet to compute on.
 */
export function registerRow(e: TouristRegisterEntry): string[] {
  // The заповед asks for series AND number where the образец gives one column, so the series leads.
  const docNumber = [e.documentSeries, e.documentNumber].filter((v) => v && v.trim() !== "").join(" ");
  return [
    String(e.registerNo),
    bgDate(e.registeredAt),
    e.registeredAtTime ?? "",
    e.personalId ?? "",
    e.nationality ?? "",
    e.firstName ?? "",
    e.middleName ?? "",
    e.lastName ?? "",
    bgDate(e.dateOfBirth),
    e.sex ? SEX_BG[e.sex] : "",
    e.documentType ? DOCUMENT_TYPE_BG[e.documentType] : "",
    docNumber,
    e.documentCountry ?? "",
    e.floor ?? "",
    e.unitLabel ?? "",
    bgDate(e.arrivalDate),
    e.arrivalTime ?? "",
    bgDate(e.departureDate),
    e.departureTime ?? "",
    String(e.nights),
    yesNo(e.touristPackage),
    // Blank, not "0.00", when there is no price: a zero here reads as a free night rather than as a
    // column the образец marks "незадължително за попълване".
    e.avgNightlyPriceMinor == null ? "" : (e.avgNightlyPriceMinor / 100).toFixed(2),
    yesNo(e.cancelled),
  ];
}

/**
 * The whole register as delimiter-separated text, headings included.
 *
 * Semicolons, because Excel on a Bulgarian machine splits on the list separator its locale sets and
 * that is `;` — a comma-separated file opens there as one column per row, which is the form in which
 * somebody decides the export is broken and goes back to typing.
 */
export function registerToCsv(entries: readonly TouristRegisterEntry[]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (cells: readonly string[]) => cells.map(esc).join(";");
  return [line(REGISTER_COLUMNS), ...entries.map((e) => line(registerRow(e)))].join("\r\n") + "\r\n";
}

/** Average paid per night, for the образец's optional price column. Null when nothing is known. */
export function averageNightlyPrice(totalMinor: number | null, nights: number): number | null {
  if (totalMinor == null || nights <= 0) return null;
  return Math.round(totalMinor / nights);
}

/**
 * Split a single booking name into the образец's three parts.
 *
 * A guess, and knowingly so. A channel sends one string and no rule recovers a Bulgarian patronymic
 * from it reliably — "Anna Maria Rossi" has no middle name, and this will call one. It exists to
 * save the desk retyping the common case, not to be trusted: every entry is checked against the
 * document before it can be reported, and that is where a wrong split is caught.
 *
 * Two parts means given + family, which is the shape almost every foreign booking arrives in. Three
 * or more puts everything between the ends into the patronymic, which is how a Bulgarian three-part
 * name reads.
 */
export function splitName(raw: string): { firstName: string | null; middleName: string | null; lastName: string | null } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, middleName: null, lastName: null };
  // One word is a given name, not a family name: it is what a channel sends when it has only a
  // first name, and putting it in the family column would be a fact rather than a blank.
  if (parts.length === 1) return { firstName: parts[0]!, middleName: null, lastName: null };
  return {
    firstName: parts[0]!,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts[parts.length - 1]!,
  };
}
