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
  /** Пореден номер от регистъра — sequential within the property, never reused. */
  registerNo: number;
  /** Дата на регистрация — when the person was registered, i.e. check-in. ISO `YYYY-MM-DD`. */
  registeredAt: string;
  /** Пълното име на лицето, as written in the document. */
  fullName: string;
  /** ЕГН / ЛЧН / персонален идентификационен номер. */
  personalId: string | null;
  /** Дата на раждане. ISO `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  /** Пол. */
  sex: Sex | null;
  /** Гражданство. ISO 3166-1 alpha-2. */
  nationality: string;
  /** Номер на лична карта / валиден национален документ за самоличност. */
  documentNumber: string | null;
  /** Серия на документа — asked for by т. 1.2 only. */
  documentSeries: string | null;
  /** Държава, издала националния документ. ISO 3166-1 alpha-2. */
  documentCountry: string | null;
  /** Етаж, стая/апартамент. */
  unitLabel: string | null;
  floor: string | null;
  /** Дата на пристигане. ISO `YYYY-MM-DD`. */
  arrivalDate: string;
  /** Дата на отпътуване. Null while the guest is still in house. ISO `YYYY-MM-DD`. */
  departureDate: string | null;
  /** Брой реализирани нощувки. */
  nights: number;
  /** Ползване на туристически пакет (да/не). */
  touristPackage: boolean;
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

  if (e.registerNo < 1 || !Number.isInteger(e.registerNo)) {
    p.push({ field: "registerNo", message: "The register number is missing." });
  }
  if (!ISO_DATE.test(e.registeredAt)) {
    p.push({ field: "registeredAt", message: "The registration date is missing." });
  }

  // "Пълното име" — the full name as the document writes it. A single word is a first name, and the
  // register is matched against a passport by a person who has only this string to go on.
  if (blank(e.fullName)) {
    p.push({ field: "fullName", message: "Full name is required." });
  } else if (e.fullName.trim().split(/\s+/).length < 2) {
    p.push({ field: "fullName", message: "Give the full name as written in the document, not just one name." });
  }

  if (blank(e.nationality)) {
    p.push({ field: "nationality", message: "Citizenship is required." });
  }
  if (e.sex == null) p.push({ field: "sex", message: "Sex is required." });
  if (blank(e.dateOfBirth) || !ISO_DATE.test(e.dateOfBirth!)) {
    p.push({ field: "dateOfBirth", message: "Date of birth is required." });
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
   * Both т. 1.1 and т. 1.2 list a personal identification number, but only a Bulgarian citizen
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
