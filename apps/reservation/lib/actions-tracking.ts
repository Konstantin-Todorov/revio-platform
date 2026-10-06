"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normaliseGa4Id, normaliseMetaPixelId } from "@revio/core";
import { setFlash } from "@revio/ui/flash";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { prisma } from "./db";
import { logAudit, str } from "./mutation-helpers";
import { i18n } from "./i18n/server";
import { tracking as trackingDict } from "./i18n/tracking";

const PAGE = "/booking-engine/tracking";

/** Save the hotel's GA4 / Meta pixel ids. Empty clears one; a value that is not an id is refused, not stored. */
export async function saveTrackingTags(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const s = (await i18n()).t(trackingDict);
  const ga4Raw = str(fd, "ga4Id");
  const metaRaw = str(fd, "metaPixelId");
  const ga4 = ga4Raw ? normaliseGa4Id(ga4Raw) : null;
  const meta = metaRaw ? normaliseMetaPixelId(metaRaw) : null;
  if (ga4Raw && !ga4) { await setFlash("error", s.errors.ga4); redirect(PAGE); }
  if (metaRaw && !meta) { await setFlash("error", s.errors.meta); redirect(PAGE); }
  await prisma.property.update({ where: { id: property.id }, data: { bookingGa4Id: ga4, bookingMetaPixelId: meta } });
  await logAudit(property.id, property.tenantId, {
    entity: "Booking engine", field: "analytics & ads",
    newValue: [ga4 && `GA4 ${ga4}`, meta && `Meta pixel ${meta}`].filter(Boolean).join(" · ") || "none",
  });
  await setFlash("success", s.saved);
  revalidatePath(PAGE);
  redirect(PAGE);
}
