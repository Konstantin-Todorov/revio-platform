"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { ensureFolio } from "./folio";
import { postFolioLine, type Outlet } from "./posting";
import { logAudit, str } from "./mutation-helpers";

/**
 * Session + capability gate for every action in this file.
 *
 * The nav and the layout route-guard hide screens from scoped roles, but neither stops a WRITE:
 * Next runs a server action first and re-renders (re-guards) afterwards, so a crafted POST from a
 * housekeeper or outlet account would otherwise commit before the guard ever fired. Denial
 * redirects the caller to their own home screen, so nothing downstream in the action runs.
 */
async function ctx(cap: Capability) {
  const session = await getSession();
  if (!session) throw new Error("No session");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
  return session;
}

/**
 * A money field, in three states rather than two.
 *
 * `null` means BLANK — leave whatever was there alone. `NaN` means the person typed something that
 * is not a number, which is a different thing entirely and must not be treated as "no change": a
 * hotelier who types a price and is told nothing will believe it saved.
 */
function moneyMinorOrBad(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").replace(",", ".").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

function moneyMinor(fd: FormData, key: string): number {
  const v = moneyMinorOrBad(fd, key);
  return v == null || Number.isNaN(v) ? 0 : v;
}

/** Tap-to-post a catalog item to a stay's folio (kind = the item's category). */
export async function postPosItem(fd: FormData): Promise<void> {
  const session = await ctx("outlet");
  const reservationId = str(fd, "reservationId");
  const posItemId = str(fd, "posItemId");

  const item = await prisma.posItem.findFirst({ where: { id: posItemId, propertyId: session.activePropertyId, active: true } });
  if (!item) redirect(`/minibar/${reservationId}`);

  const folioId = await ensureFolio(session.tenantId, session.activePropertyId, reservationId);
  if (!folioId) redirect("/minibar");
  const folio = await prisma.folio.findUnique({ where: { id: folioId }, select: { status: true } });
  if (folio?.status !== "open") redirect(`/minibar/${reservationId}?error=closed`);

  // Native POS is a CALLER of the posting service (spec §1.7) — the outlet is the item's outlet.
  await postFolioLine({ tenantId: session.tenantId, propertyId: session.activePropertyId, folioId, kind: item!.category, description: item!.name, amountMinor: item!.priceMinor, outlet: item!.outlet as Outlet, postedById: session.userId });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_charge", field: item!.name, newValue: `+${item!.priceMinor}`, userId: session.userId });
  revalidatePath(`/minibar/${reservationId}`);
  revalidatePath(`/folio/${reservationId}`);
  revalidatePath("/folios");
}

// --- Catalog management ----------------------------------------------------

const OUTLETS = ["minibar", "spa", "bar", "restaurant"];

export async function createPosItem(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const name = str(fd, "name");
  const category = str(fd, "category") === "extra" ? "extra" : "minibar";
  const outlet = OUTLETS.includes(str(fd, "outlet")) ? str(fd, "outlet") : "minibar";
  const priceMinor = moneyMinor(fd, "price");
  if (Number.isNaN(moneyMinorOrBad(fd, "price"))) redirect("/minibar/catalog?error=price");
  if (!name || priceMinor <= 0) redirect("/minibar/catalog?error=fields");

  const count = await prisma.posItem.count({ where: { propertyId: session.activePropertyId } });
  await prisma.posItem.create({ data: { tenantId: session.tenantId, propertyId: session.activePropertyId, name, outlet, category, priceMinor, sortOrder: count } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "create", newValue: `${name} ${priceMinor}`, userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}

export async function updatePosItem(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const id = str(fd, "id");
  const item = await prisma.posItem.findFirst({ where: { id, propertyId: session.activePropertyId } });
  if (!item) return;
  // A price that will not parse is REFUSED, not ignored. It used to fall through to "keep the old
  // one", so typing letters into the field changed the name, said nothing, and left the price as it
  // was — the hotelier walks away believing they repriced an item they did not.
  const priceMinor = moneyMinorOrBad(fd, "price");
  if (priceMinor != null && (Number.isNaN(priceMinor) || priceMinor <= 0)) {
    redirect("/minibar/catalog?error=price");
  }
  await prisma.posItem.update({
    where: { id },
    data: {
      name: str(fd, "name") || item.name,
      outlet: OUTLETS.includes(str(fd, "outlet")) ? str(fd, "outlet") : item.outlet,
      category: str(fd, "category") === "extra" ? "extra" : "minibar",
      priceMinor: priceMinor ?? item.priceMinor,
      active: fd.get("active") != null,
    },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "edit", newValue: str(fd, "name"), userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}

export async function deletePosItem(fd: FormData): Promise<void> {
  const session = await ctx("manage");
  const id = str(fd, "id");
  const item = await prisma.posItem.findFirst({ where: { id, propertyId: session.activePropertyId } });
  if (!item) return;
  await prisma.posItem.delete({ where: { id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "pos_item", field: "delete", oldValue: item.name, userId: session.userId });
  revalidatePath("/minibar/catalog");
  revalidatePath("/minibar");
}
