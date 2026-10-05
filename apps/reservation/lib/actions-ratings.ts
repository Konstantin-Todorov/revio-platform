"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRatingTenths, ratingUrlAllowed, RATING_SOURCES, type RatingSource } from "@revio/core";
import { setFlash } from "@revio/ui/flash";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { prisma } from "./db";
import { int, str } from "./mutation-helpers";
import { pressedTwice } from "./submit-once";
import { i18n } from "./i18n/server";
import { ratings as ratingsDict } from "./i18n/ratings";

const PAGE = "/booking-engine/ratings";

function sourceOf(fd: FormData): RatingSource | null {
  const s = str(fd, "source");
  return (RATING_SOURCES as readonly string[]).includes(s) ? (s as RatingSource) : null;
}

/** Save one source's score. Saving again is what "confirmed" means — the date moves to today. */
export async function saveRating(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  if (await pressedTwice(fd, property.tenantId, "saveRating")) redirect(PAGE);
  const s = (await i18n()).t(ratingsDict);
  const source = sourceOf(fd);
  if (!source) redirect(PAGE);
  const scoreTenths = parseRatingTenths(source, str(fd, "score"));
  if (scoreTenths == null) {
    await setFlash("error", s.errors.score(s.scale[source]));
    redirect(PAGE);
  }
  const url = str(fd, "url");
  if (url && !ratingUrlAllowed(source, url)) {
    await setFlash("error", s.errors.url);
    redirect(PAGE);
  }
  const count = int(fd, "reviewCount", 0);
  const data = {
    scoreTenths: scoreTenths!,
    reviewCount: Number.isInteger(count) && count > 0 ? count : null,
    url: url || null,
    confirmedAt: new Date(),
  };
  await prisma.publicRating.upsert({
    where: { propertyId_source: { propertyId: property.id, source } },
    create: { tenantId: property.tenantId, propertyId: property.id, source, ...data },
    update: data,
  });
  await setFlash("success", s.saved(s.sources[source]));
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function removeRating(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const s = (await i18n()).t(ratingsDict);
  const source = sourceOf(fd);
  if (source) {
    await prisma.publicRating.deleteMany({ where: { propertyId: property.id, source } });
    await setFlash("success", s.removed(s.sources[source]));
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}
