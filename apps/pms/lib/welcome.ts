import "server-only";
import { getWelcomeFacts } from "@revio/db";
import type { WelcomeFacts } from "@revio/core";
import { prisma } from "./db";
import { activeProperty } from "./data";

/**
 * What the shared core already holds for this hotel — the input to `welcomeFlow`.
 *
 * The PMS is the product most likely to be bought second or third, so this is the app where the
 * inheritance matters most: everything except the physical rooms usually carries over.
 */
export async function getWelcomeFactsForProperty(): Promise<WelcomeFacts> {
  const { property } = await activeProperty();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: property.tenantId },
    select: { hasChannelManager: true, hasReservation: true, hasPms: true },
  });
  return getWelcomeFacts(prisma, property.id, tenant, "RevioPMS");
}
