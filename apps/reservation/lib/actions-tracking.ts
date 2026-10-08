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

/**
 * The hotel's own privacy policy for its booking page. Empty clears it, and the page then links the
 * notice it generates from the hotel's details — never nothing. Only an absolute http(s) address is
 * stored: this value becomes an href on a public page.
 */
export async function savePrivacyUrl(fd: FormData): Promise<void> {
  await requireCapability("manageSettings");
  const property = await getProperty();
  const s = (await i18n()).t(trackingDict);
  const raw = str(fd, "privacyUrl");
  let url: string | null = null;
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      url = u.toString();
    } catch {
      await setFlash("error", s.errors.privacyUrl);
      redirect(PAGE);
    }
  }
  await prisma.property.update({ where: { id: property.id }, data: { bookingPrivacyUrl: url } });
  await logAudit(property.id, property.tenantId, { entity: "Booking engine", field: "privacy policy", newValue: url ?? "generated notice" });
  await setFlash("success", s.privacy.saved);
  revalidatePath(PAGE);
  redirect(PAGE);
}
