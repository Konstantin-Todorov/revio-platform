"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DIRECT_DISCOUNT_MAX, normalisePromo } from "@revio/core";
import { setFlash } from "@revio/ui/flash";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { prisma } from "./db";
import { int, str, strList, utcDay } from "./mutation-helpers";
import { pressedTwice } from "./submit-once";
import { i18n } from "./i18n/server";
import { promo as promoDict } from "./i18n/promo";

const PAGE = "/rooms-rates/promo";

/** A new promo code — a percentage off the rooms on RevioDirect. */
export async function createPromoCode(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();
  if (await pressedTwice(fd, property.tenantId, "createPromoCode")) redirect(PAGE);
  const s = (await i18n()).t(promoDict);
  const code = normalisePromo(str(fd, "code"));
  const percentOff = int(fd, "percentOff", 0);
  const from = str(fd, "stayFrom");
  const to = str(fd, "stayTo");
  const fail = async (msg: string) => { await setFlash("error", msg); redirect(PAGE); };
  if (code.length < 3) return fail(s.errors.code);
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 90) return fail(s.errors.percent);
  if (from && to && to < from) return fail(s.errors.dates);
  const exists = await prisma.promoCode.findFirst({ where: { propertyId: property.id, code } });
  if (exists) return fail(s.errors.taken(code));
  const minNights = int(fd, "minNights", 0);
  const maxUses = int(fd, "maxUses", 0);
  await prisma.promoCode.create({
    data: {
      tenantId: property.tenantId, propertyId: property.id, code, percentOff,
      stayFrom: /^\d{4}-\d{2}-\d{2}$/.test(from) ? utcDay(from) : null,
      stayTo: /^\d{4}-\d{2}-\d{2}$/.test(to) ? utcDay(to) : null,
      minNights: Number.isFinite(minNights) && minNights > 0 ? minNights : null,
      maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      ratePlanIds: strList(fd, "ratePlanIds"),
    },
  });
  await setFlash("success", s.saved(code));
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function togglePromoCode(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();
  const id = str(fd, "id");
  const row = await prisma.promoCode.findFirst({ where: { id, propertyId: property.id } });
  if (row) await prisma.promoCode.update({ where: { id }, data: { active: !row.active } });
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deletePromoCode(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();
  await prisma.promoCode.deleteMany({ where: { id: str(fd, "id"), propertyId: property.id } });
  revalidatePath(PAGE);
  redirect(PAGE);
}

/** The hotel's direct-booking discount: a percentage off rates also sold on a booking site. */
export async function saveDirectDiscount(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();
  if (await pressedTwice(fd, property.tenantId, "saveDirectDiscount")) redirect(PAGE);
  const s = (await i18n()).t(promoDict);
  const pct = int(fd, "directDiscountPct", -1);
  if (!Number.isInteger(pct) || pct < 0 || pct > DIRECT_DISCOUNT_MAX) {
    await setFlash("error", s.direct.error);
    redirect(PAGE);
  }
  await prisma.property.update({ where: { id: property.id }, data: { directDiscountPct: pct } });
  await setFlash("success", s.direct.saved(pct));
  revalidatePath(PAGE);
  redirect(PAGE);
}
