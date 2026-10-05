"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { requireCapability } from "./authz";
import type { Session } from "./session";
import { logAudit, str } from "./mutation-helpers";
import { wallClockToUtc } from "@revio/core";
import { flashError } from "@revio/ui/flash";
import { i18n } from "./i18n/server";
import { flash } from "./i18n/flash";

/**
 * Store the fiscal receipt the hotel's own device issued for a desk payment.
 *
 * Two ways in, one record: the PMS page printed it through ErpNet.FP and hands us what the DEVICE
 * returned (`printed`), or the receptionist typed the number off a receipt from the till (`manual`).
 * Either way the number is the device's — this file only holds it.
 *
 * A receipt, once recorded, is not overwritten. A second print of the same payment would be a second
 * fiscal sale, so the guard that matters is here, not in the button: the `updateMany` only touches a
 * payment line that has no receipt yet.
 */

export type SaveReceiptResult = { ok: true } | { ok: false; reason: "not_found" | "already" | "invalid" | "forbidden" };

type PrintedReceipt = { items: { text: string; taxGroup: number; amountMinor: number }[]; paymentType: string };

async function save(session: Session, lineId: string, data: { no: string; atLocal: string | null; serial: string | null; source: "printed" | "manual"; printed?: PrintedReceipt }): Promise<SaveReceiptResult> {
  const no = data.no.trim().slice(0, 40);
  if (!no) return { ok: false, reason: "invalid" };
  const line = await prisma.folioLine.findFirst({
    where: { id: lineId, propertyId: session.activePropertyId, kind: "payment", voided: false },
    select: { id: true, amountMinor: true, fiscalReceiptNo: true, folio: { select: { reservationId: true } }, property: { select: { timezone: true } } },
  });
  if (!line) return { ok: false, reason: "not_found" };
  if (line.fiscalReceiptNo) return { ok: false, reason: "already" };
  // Kept so a storno can mirror the receipt line for line — and only when it is the receipt of THIS
  // payment: lines that do not add up to its amount are not stored, rather than stored wrong.
  const printed = data.printed && data.printed.items.reduce((a, i) => a + Math.round(i.amountMinor), 0) === line.amountMinor
    ? { items: data.printed.items.map((i) => ({ text: String(i.text).slice(0, 40), taxGroup: Math.trunc(i.taxGroup), amountMinor: Math.round(i.amountMinor) })), paymentType: data.printed.paymentType === "card" ? "card" : "cash", receiptNumber: no, receiptDateTime: data.atLocal, fiscalMemorySerialNumber: data.serial }
    : undefined;
  const r = await prisma.folioLine.updateMany({
    where: { id: lineId, fiscalReceiptNo: null },
    // The device reports its own wall clock with no zone; it is the property's local time.
    data: { fiscalReceiptNo: no, fiscalReceiptAt: (data.atLocal && wallClockToUtc(data.atLocal, line.property.timezone)) || new Date(), fiscalDeviceSerial: data.serial?.slice(0, 40) ?? null, fiscalSource: data.source, ...(printed ? { fiscalReceiptData: printed } : {}) },
  });
  if (r.count !== 1) return { ok: false, reason: "already" };
  await logAudit(session.activePropertyId, session.tenantId, { entity: "fiscal_receipt", field: lineId, newValue: `${data.source} ${no}${data.serial ? ` · ${data.serial}` : ""}`, userId: session.userId });
  if (line.folio.reservationId) revalidatePath(`/folio/${line.folio.reservationId}`);
  return { ok: true };
}

/** Called by the folio page after ErpNet.FP printed the receipt. Values are the device's own. */
export async function saveFiscalReceipt(input: { lineId: string; receiptNumber: string; receiptDateTime?: string | null; fiscalMemorySerialNumber?: string | null; printed?: PrintedReceipt }): Promise<SaveReceiptResult> {
  const session = await requireCapability("frontDesk");
  if (!session) return { ok: false, reason: "forbidden" };
  return save(session, input.lineId, {
    no: String(input.receiptNumber ?? ""),
    atLocal: input.receiptDateTime ? String(input.receiptDateTime) : null,
    serial: input.fiscalMemorySerialNumber ? String(input.fiscalMemorySerialNumber) : null,
    source: "printed",
    printed: input.printed,
  });
}

/** The receptionist types the number from a receipt the till printed. */
export async function recordManualReceipt(fd: FormData): Promise<void> {
  const session = await requireCapability("frontDesk");
  if (!session) redirect("/dashboard?error=forbidden");
  const r = await save(session, str(fd, "lineId"), { no: str(fd, "receiptNumber"), atLocal: null, serial: null, source: "manual" });
  if (!r.ok) {
    const say = (await i18n()).t(flash).folio;
    await flashError(r.reason === "already" ? say.receiptAlready : say.receiptNumber);
  }
}

/**
 * The storno receipt for a VOIDED payment that had a fiscal receipt.
 *
 * Voiding the line corrects our record; only a storno corrects the device's. Until one is recorded the
 * folio says so, because a void with no storno leaves the till's turnover higher than the money in it.
 */
async function saveStorno(session: Session, lineId: string, data: { no: string; atLocal: string | null; reason: string; source: "printed" | "manual" }): Promise<SaveReceiptResult> {
  const no = data.no.trim().slice(0, 40);
  if (!no) return { ok: false, reason: "invalid" };
  const reason = data.reason === "refund" ? "refund" : "operator_error";
  const line = await prisma.folioLine.findFirst({
    where: { id: lineId, propertyId: session.activePropertyId, kind: "payment", voided: true, fiscalReceiptNo: { not: null } },
    select: { id: true, fiscalStornoNo: true, folio: { select: { reservationId: true } }, property: { select: { timezone: true } } },
  });
  if (!line) return { ok: false, reason: "not_found" };
  if (line.fiscalStornoNo) return { ok: false, reason: "already" };
  const r = await prisma.folioLine.updateMany({
    where: { id: lineId, fiscalStornoNo: null },
    data: { fiscalStornoNo: no, fiscalStornoAt: (data.atLocal && wallClockToUtc(data.atLocal, line.property.timezone)) || new Date(), fiscalStornoReason: reason, fiscalStornoSource: data.source },
  });
  if (r.count !== 1) return { ok: false, reason: "already" };
  await logAudit(session.activePropertyId, session.tenantId, { entity: "fiscal_storno", field: lineId, newValue: `${data.source} ${no} · ${reason}`, userId: session.userId });
  if (line.folio.reservationId) revalidatePath(`/folio/${line.folio.reservationId}`);
  return { ok: true };
}

/** Called by the folio page after ErpNet.FP printed the storno. */
export async function saveFiscalStorno(input: { lineId: string; receiptNumber: string; receiptDateTime?: string | null; reason: string }): Promise<SaveReceiptResult> {
  const session = await requireCapability("manage");
  if (!session) return { ok: false, reason: "forbidden" };
  return saveStorno(session, input.lineId, { no: String(input.receiptNumber ?? ""), atLocal: input.receiptDateTime ? String(input.receiptDateTime) : null, reason: input.reason, source: "printed" });
}

/** A storno printed on the till, its number typed in. */
export async function recordManualStorno(fd: FormData): Promise<void> {
  const session = await requireCapability("manage");
  if (!session) redirect("/dashboard?error=forbidden");
  const r = await saveStorno(session, str(fd, "lineId"), { no: str(fd, "receiptNumber"), atLocal: null, reason: str(fd, "reason"), source: "manual" });
  if (!r.ok) {
    const say = (await i18n()).t(flash).folio;
    await flashError(r.reason === "already" ? say.receiptAlready : say.receiptNumber);
  }
}

/**
 * A daily (Z) or interim (X) report printed on the device from Close Day. The device keeps the report
 * itself; we only note that it was printed, by whom and when, so Close Day can say whether today's
 * Z is done. No table of our own: the audit trail is the record of an action, which is what this is.
 */
export async function recordFiscalReport(input: { kind: "z" | "x" }): Promise<SaveReceiptResult> {
  const session = await requireCapability("manage");
  if (!session) return { ok: false, reason: "forbidden" };
  const kind = input.kind === "z" ? "z" : "x";
  await logAudit(session.activePropertyId, session.tenantId, { entity: "fiscal_report", field: kind, newValue: "printed", userId: session.userId });
  revalidatePath("/closeday");
  return { ok: true };
}
