import type { TouristRegisterEntry } from "./tourist-register.js";

/**
 * The register as ЕСТИ's import file — the "текстови файл в утвърден формат".
 *
 * Source: "Описание на интерфейсите за комуникация с ЕСТИ" (Ministry of Tourism, 2023-02), §2,
 * kept in `docs/specs/esti/`. This is a DIFFERENT file from the образец export in
 * `tourist-register.ts`: the образец is the register a property must keep and show on inspection;
 * this is what ЕСТИ's upload accepts. Different column names, different codes (ICA/PAS/DRL, M/F,
 * TRUE/FALSE), dates with times, and a record type that says whether a row is new, changed or
 * withdrawn. Sending the образец to the upload is the mistake this file exists to prevent.
 *
 * File rules (§2): `;` separator, UTF-8, a heading row, `.CSV`.
 */

/** The spec's columns, in the spec's order. */
export const ESTI_COLUMNS: readonly string[] = [
  "AccomodationPlaceUin",
  "AccomodationRegisterUin",
  "RegistrationDate",
  "IdentityNumber",
  "FirstName",
  "MiddleName",
  "LastName",
  "BirthDate",
  "GenderTypeCode",
  "IdentityDocumentTypeCode",
  "IdentityDocumentNumber",
  "IdentityDocumentCountryCode",
  "Floor",
  "Room",
  "CheckInDate",
  "CheckOutDate",
  "TouristPackage",
  "AvgNightPrice",
  "RegistrationTypeCode",
];

export type EstiChange = "NEW" | "UPD" | "DEL";

/** What ЕСТИ last received for one registration — null when it never received it. */
export interface EstiSubmitted {
  fingerprint: string;
}

export type EstiEntry = TouristRegisterEntry & { id: string };

/**
 * The fields ЕСТИ holds, joined. If this changes after a submission, the row goes again as UPD;
 * a change ЕСТИ never sees (a note, a price the guest re-split) does not resend anything.
 */
export function estiFingerprint(e: EstiEntry): string {
  return [
    e.personalId, e.firstName, e.middleName, e.lastName, e.dateOfBirth, e.sex, e.documentType,
    e.documentSeries, e.documentNumber, e.documentCountry, e.floor, e.unitLabel, e.arrivalDate,
    e.arrivalTime, e.departureDate, e.departureTime, e.touristPackage, e.avgNightlyPriceMinor,
  ].map((v) => (v == null ? "" : String(v))).join("|");
}

/**
 * What to send for one registration, or null for nothing.
 *
 * - never sent, not cancelled → NEW
 * - never sent, cancelled → nothing (ЕСТИ never knew it, so there is nothing to withdraw)
 * - sent, now cancelled → DEL
 * - sent, ЕСТИ's fields changed since → UPD
 * - sent and unchanged → nothing
 */
export function estiChange(e: EstiEntry, submitted: EstiSubmitted | null): EstiChange | null {
  if (!submitted) return e.cancelled ? null : "NEW";
  if (e.cancelled) return submitted.fingerprint.startsWith("DEL:") ? null : "DEL";
  return estiFingerprint(e) === submitted.fingerprint ? null : "UPD";
}

/** What is stored after a row is sent, so the next file knows what ЕСТИ already has. */
export function estiSubmittedFingerprint(e: EstiEntry, change: EstiChange): string {
  return change === "DEL" ? `DEL:${estiFingerprint(e)}` : estiFingerprint(e);
}

export type EstiProblem =
  | "place_uin"
  | "first_name"
  | "last_name"
  | "birth_date"
  | "sex"
  | "document_type"
  | "document_country"
  | "identity"
  | "check_out";

const DOC: Record<string, string> = { id_card: "ICA", passport: "PAS" };

/**
 * What stops a row from being accepted, by the spec's "задължителна колона" rules.
 *
 * - FirstName, LastName, BirthDate, GenderTypeCode, IdentityDocumentTypeCode,
 *   IdentityDocumentCountryCode, CheckInDate, CheckOutDate are always required.
 * - IdentityNumber (ЕГН/ЛНЧ) is required for a Bulgarian citizen; a foreigner needs either an ЛНЧ
 *   or an IdentityDocumentNumber.
 * - The document type must be one ЕСТИ knows: ICA, PAS or DRL. Our "other" is not one of them.
 *
 * A cancelled row being withdrawn (DEL) still carries the identifying columns, so the same rules
 * apply — ЕСТИ matches it by AccomodationRegisterUin, but the file must still parse.
 */
export function estiProblems(e: EstiEntry, placeUin: string | null): EstiProblem[] {
  const p: EstiProblem[] = [];
  if (!placeUin?.trim()) p.push("place_uin");
  if (!e.firstName?.trim()) p.push("first_name");
  if (!e.lastName?.trim()) p.push("last_name");
  if (!e.dateOfBirth) p.push("birth_date");
  if (!e.sex) p.push("sex");
  if (!e.documentType || !DOC[e.documentType]) p.push("document_type");
  if (!e.documentCountry?.trim()) p.push("document_country");
  const bg = (e.nationality ?? "").toUpperCase() === "BG";
  if (bg ? !e.personalId?.trim() : !(e.personalId?.trim() || e.documentNumber?.trim())) p.push("identity");
  if (!e.departureDate) p.push("check_out");
  return p;
}

/** `2026-09-03` + `14:05` → `03.09.2026 14:05`. A missing time is noon — the spec has no blank. */
function dt(iso: string | null, time: string | null, fallback = "12:00"): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y} ${time ?? fallback}`;
}
function date(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
const cap = (v: string | null | undefined, n: number) => (v ?? "").trim().slice(0, n);

/**
 * One row as ЕСТИ's columns.
 *
 * `checkInTime`/`checkOutTime` are the property's standard times, used when a stay has not been
 * physically checked in or out yet (a reservation's planned departure has a date and no clock).
 */
export function estiRow(
  e: EstiEntry,
  placeUin: string,
  change: EstiChange,
  times: { checkIn: string; checkOut: string } = { checkIn: "14:00", checkOut: "12:00" },
): string[] {
  const docNumber = [e.documentSeries, e.documentNumber].filter((v) => v && v.trim() !== "").join("");
  return [
    cap(placeUin, 500),
    // Our StayGuest id: unique, stable, never reused — what ЕСТИ needs to match a later UPD/DEL.
    cap(e.id, 500),
    dt(e.registeredAt, e.registeredAtTime),
    cap(e.personalId, 10),
    cap(e.firstName, 150),
    cap(e.middleName, 150),
    cap(e.lastName, 150),
    date(e.dateOfBirth),
    e.sex ? e.sex.toUpperCase() : "",
    e.documentType ? (DOC[e.documentType] ?? "") : "",
    cap(docNumber, 20),
    (e.documentCountry ?? "").toUpperCase(),
    cap(floorOnly(e.floor), 10),
    cap(e.unitLabel, 10),
    dt(e.arrivalDate, e.arrivalTime, times.checkIn),
    dt(e.departureDate, e.departureTime, times.checkOut),
    e.touristPackage ? "TRUE" : "FALSE",
    e.avgNightlyPriceMinor == null ? "" : (e.avgNightlyPriceMinor / 100).toFixed(2),
    change,
  ];
}

/** "Floor 3" → "3"; a label without a number passes through. Same rule as the образец export. */
function floorOnly(label: string | null): string {
  if (!label) return "";
  const m = label.match(/-?\d+/);
  return m ? m[0] : label.trim();
}

/** The upload file. UTF-8 with a BOM so Excel shows Cyrillic if somebody opens it first. */
export function estiCsv(rows: readonly string[][]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (cells: readonly string[]) => cells.map(esc).join(";");
  return "﻿" + [line(ESTI_COLUMNS), ...rows.map(line)].join("\r\n") + "\r\n";
}
