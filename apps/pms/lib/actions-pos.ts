"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { ensureFolio } from "./folio";
import { logAudit, str } from "./mutation-helpers";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

function moneyMinor(fd: FormData, key: string): number {
  const n = Number(String(fd.get(key) ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Tap-to-post a catalog item to a stay's folio (kind = the item's category). */
export async function postPosItem(fd: FormData): Promise<void> {
  const session = await ctx();
  const reservationId = str(fd, "reservationId");
  const posItemId = str(fd, "posItemId");

  const item = await prisma.posItem.findFirst({ where: { id: posItemId, propertyId: session.activePropertyId, active: true } });
  if (!item) redirect(`/minibar/${reservationId}`);

  const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  if (!folioId) redirect("/minibar");
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, select: { status: true } });
  if (folio?.status !== "open") redirect(`/minibar/${reservationId}?error=closed`);

  await prisma.folioLine.create({
    data: { tenantId: session.tenantId, propertyId: session.activePropertyId, folioId, kind: item!.category, description: item!.name, amountMinor: item!.priceMinor, postedById: session.userId },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_charge", field: item!.name, newValue: `+${item!.priceMinor}`, userId: session.userId });
  revalidatePath(`/minibar/${reservationId}`);
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/folios");
}

// --- Catalog management ----------------------------------------------------

export async function createPosItem(fd: FormData): Promise<void> {
  const session = await ctx();
  const name = str(fd, "name");
  const category = str(fd, "category") === "extra" ? "extra" : "minibar";
  const priceMinor = moneyMinor(fd, "price");
  if (!name || priceMinor <= 0) redirect("/minibar/catalog?error=fields");

  const count = await prisma.posItem.count({ where: { propertyId: session.activePropertyId } });
  await prisma.posItem.create({ data: { tenantId: session.tenantId, propertyId: session.activePropertyId, name, category, priceMinor, sortOrder: count } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "create", newValue: `${name} ${priceMinor}`, userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}

export async function updatePosItem(fd: FormData): Promise<void> {
  const session = await ctx();
  const id = str(fd, "id");
  const item = await prisma.posItem.findFirst({ where: { id, propertyId: session.activePropertyId } });
  if (!item) return;
  const priceMinor = moneyMinor(fd, "price");
  await prisma.posItem.update({
    where: { id },
    data: {
      name: str(fd, "name") || item.name,
      category: str(fd, "category") === "extra" ? "extra" : "minibar",
      priceMinor: priceMinor > 0 ? priceMinor : item.priceMinor,
      active: fd.get("active") != null,
    },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "edit", newValue: str(fd, "name"), userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}

export async function deletePosItem(fd: FormData): Promise<void> {
  const session = await ctx();
  const id = str(fd, "id");
  const item = await prisma.posItem.findFirst({ where: { id, propertyId: session.activePropertyId } });
  if (!item) return;
  await prisma.posItem.delete({ where: { id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "delete", oldValue: item.name, userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}
