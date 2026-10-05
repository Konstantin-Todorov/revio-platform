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

async function save(session: Session, lineId: string, data: { no: string; atLocal: string | null; serial: string | null; source: "printed" | "manual" }): Promise<SaveReceiptResult> {
  const no = data.no.trim().slice(0, 40);
  if (!no) return { ok: false, reason: "invalid" };
  const line = await prisma.folioLine.findFirst({
    where: { id: lineId, propertyId: session.activePropertyId, kind: "payment", voided: false },
    select: { id: true, fiscalReceiptNo: true, folio: { select: { reservationId: true } }, property: { select: { timezone: true } } },
  });
  if (!line) return { ok: false, reason: "not_found" };
  if (line.fiscalReceiptNo) return { ok: false, reason: "already" };
  const r = await prisma.folioLine.updateMany({
    where: { id: lineId, fiscalReceiptNo: null },
    // The device reports its own wall clock with no zone; it is the property's local time.
    data: { fiscalReceiptNo: no, fiscalReceiptAt: (data.atLocal && wallClockToUtc(data.atLocal, line.property.timezone)) || new Date(), fiscalDeviceSerial: data.serial?.slice(0, 40) ?? null, fiscalSource: data.source },
  });
  if (r.count !== 1) return { ok: false, reason: "already" };
  await logAudit(session.activePropertyId, session.tenantId, { entity: "fiscal_receipt", field: lineId, newValue: `${data.source} ${no}${data.serial ? ` · ${data.serial}` : ""}`, userId: session.userId });
  if (line.folio.reservationId) revalidatePath(`/folio/${line.folio.reservationId}`);
  return { ok: true };
}

/** Called by the folio page after ErpNet.FP printed the receipt. Values are the device's own. */
export async function saveFiscalReceipt(input: { lineId: string; receiptNumber: string; receiptDateTime?: string | null; fiscalMemorySerialNumber?: string | null }): Promise<SaveReceiptResult> {
  const session = await requireCapability("frontDesk");
  if (!session) return { ok: false, reason: "forbidden" };
  return save(session, input.lineId, {
    no: String(input.receiptNumber ?? ""),
    atLocal: input.receiptDateTime ? String(input.receiptDateTime) : null,
    serial: input.fiscalMemorySerialNumber ? String(input.fiscalMemorySerialNumber) : null,
    source: "printed",
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
