"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { ensureFolio } from "./folio";
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
