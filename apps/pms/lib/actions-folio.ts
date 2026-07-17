"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { ensureFolio, createSplitFolio, folioBalance } from "./folio";
import { postFolioLine } from "./posting";
import { logAudit, str } from "./mutation-helpers";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

const CHARGE_KINDS = ["minibar", "extra", "fee"];
const PAY_METHODS: Record<string, string> = {
  cash: "Cash", card: "Card", company_account: "Company account", bank_transfer: "Bank transfer",
};

/** Parse a decimal amount field (major units) into integer minor units. */
function moneyMinor(fd: FormData, key: string): number {
  const n = Number(String(fd.get(key) ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function refresh(reservationId: string) {
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/folios");
  revalidatePath("/dashboard");
}

async function openFolioId(session: { tenantId: string; activePropertyId: string }, reservationId: string): Promise<string | null> {
  const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  if (!folioId) return null;
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, select: { status: true } });
  return folio?.status === "open" ? folioId : null;
}

/** Post a charge (minibar / extra / fee) to a stay's folio. */
export async function postCharge(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const kind = str(fd, "kind");
  const description = str(fd, "description");
  const amountMinor = moneyMinor(fd, "amount");
  if (!CHARGE_KINDS.includes(kind) || !description || amountMinor <= 0) redirect(`/folio/${reservationId}?error=charge`);

  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);
  // Route through the single charge-posting service so the line is tagged (outlet + tax category).
  await postFolioLine({ tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!, kind, description, amountMinor, postedById: session.userId });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_charge", field: description, newValue: `${kind} +${amountMinor}`, userId: session.userId });
  refresh(reservationId);
}

/** Record a payment (label + amount only — no card data). */
export async function postPayment(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const method = str(fd, "method");
  const amountMinor = moneyMinor(fd, "amount");
  const ref = str(fd, "ref") || null;
  if (!PAY_METHODS[method] || amountMinor <= 0) redirect(`/folio/${reservationId}?error=payment`);

  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);
  await postFolioLine({ tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!, kind: "payment", description: PAY_METHODS[method]!, amountMinor, method, ref, postedById: session.userId });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_payment", field: PAY_METHODS[method], newValue: `-${amountMinor}`, userId: session.userId });
  refresh(reservationId);
}

/**
 * Capture a deposit (spec §4.4). A deposit is NOT revenue — it's money held that may be returned.
 * The deposit TYPE decides the behaviour:
 *   held    → a `deposit_held` line in its own folio section, outside the running balance. Not a
 *             taxable supply until applied, so it carries no VAT unless the type says vatTiming=capture.
 *   applied → recorded straight as a `payment`: the balance drops now (consumption-prepayment model).
 */
export async function captureDeposit(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const depositTypeId = str(fd, "depositTypeId");
  const method = str(fd, "method") || "cash";
  const amountMinor = moneyMinor(fd, "amount");
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  const type = await prisma.depositType.findFirst({ where: { id: depositTypeId, propertyId: session.activePropertyId, active: true } });
  if (!type) redirect(`/folio/${reservationId}?error=deposit`);
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  const applied = type!.behaviour === "applied";
  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: applied ? "payment" : "deposit_held",
    description: `${type!.name} deposit${applied ? "" : " (held)"}`,
    amountMinor, method, depositTypeId: type!.id,
    // VAT point: at capture only when the type says so; a held deposit is otherwise not yet taxable.
    ...(applied ? {} : { taxCategory: type!.vatTiming === "capture" ? ("standard" as const) : null }),
    postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_capture", field: type!.name, newValue: `${applied ? "applied" : "held"} ${amountMinor}`, userId: session.userId });
  refresh(reservationId);
}

/** Apply held deposit money to the bill — only NOW does it count as a payment (and the VAT point
 * triggers for a vatTiming=use type). Capped at what's actually held. */
export async function useDeposit(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  const lines = await prisma.folioLine.findMany({ where: { folioId: folioId! }, select: { kind: true, amountMinor: true, voided: true } });
  const { depositsHeld, balance } = folioBalance(lines);
  const requested = moneyMinor(fd, "amount");
  // Never apply more than is held, nor more than is owed.
  const amountMinor = Math.min(requested > 0 ? requested : depositsHeld, depositsHeld, Math.max(0, balance));
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: "deposit_use", description: "Deposit applied to balance", amountMinor,
    taxCategory: "standard", postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_use", field: "applied to balance", newValue: String(amountMinor), userId: session.userId });
  refresh(reservationId);
}

/** Return held deposit money to the guest — reduces the liability, never touches revenue. */
export async function refundDeposit(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const folioId = await openFolioId(session, reservationId);
  if (!folioId) redirect(`/folio/${reservationId}?error=closed`);

  const lines = await prisma.folioLine.findMany({ where: { folioId: folioId! }, select: { kind: true, amountMinor: true, voided: true } });
  const { depositsHeld } = folioBalance(lines);
  const requested = moneyMinor(fd, "amount");
  const amountMinor = Math.min(requested > 0 ? requested : depositsHeld, depositsHeld);
  if (amountMinor <= 0) redirect(`/folio/${reservationId}?error=deposit`);

  await postFolioLine({
    tenantId: session.tenantId, propertyId: session.activePropertyId, folioId: folioId!,
    kind: "deposit_refund", description: "Deposit refunded", amountMinor,
    method: str(fd, "method") || "cash", taxCategory: null, postedById: session.userId,
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "deposit_refund", field: "returned to guest", newValue: String(amountMinor), userId: session.userId });
  refresh(reservationId);
}

/** Add a split / company folio to the stay (spec §3.6). Charge lines can then be moved onto it. */
export async function createFolio(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const label = str(fd, "label") || "Company";
  await createSplitFolio(session.tenantId, session.activePropertyId, reservationId, label);
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_split", field: label, newValue: "added", userId: session.userId });
  refresh(reservationId);
}

/** Move a charge line onto another folio of the SAME stay — the one mechanism behind every split
 * (room→company, extras→guest, 50/50). Payments and closed folios are off-limits. */
export async function moveFolioLine(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const lineId = str(fd, "lineId");
  const targetFolioId = str(fd, "targetFolioId");

  const line = await prisma.folioLine.findFirst({ where: { id: lineId, propertyId: session.activePropertyId }, include: { folio: { select: { reservationId: true } } } });
  if (!line || line.voided || line.kind === "payment") redirect(`/folio/${reservationId}`);
  const target = await prisma.folio.findFirst({ where: { id: targetFolioId, reservationId, status: "open" }, select: { id: true } });
  // Both source and target must belong to THIS reservation, and the target must be open.
  if (!target || line!.folio.reservationId !== reservationId) redirect(`/folio/${reservationId}`);

  await prisma.folioLine.update({ where: { id: lineId }, data: { folioId: target!.id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_move", field: line!.description, newValue: `→ folio ${target!.id.slice(-6)}`, userId: session.userId });
  refresh(reservationId);
}

/** Void a folio line (flagged, never deleted — audit trail). Accommodation lines are authoritative and can't be voided. */
export async function voidFolioLine(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const lineId = str(fd, "lineId");
  const line = await prisma.folioLine.findFirst({ where: { id: lineId, propertyId: session.activePropertyId } });
  if (!line || line.voided) redirect(`/folio/${reservationId}`);
  if (line.kind === "accommodation") redirect(`/folio/${reservationId}?error=voidaccom`);

  await prisma.folioLine.update({ where: { id: lineId }, data: { voided: true } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "folio_void", field: line.description, oldValue: String(line.amountMinor), newValue: "voided", userId: session.userId });
  refresh(reservationId);
}
