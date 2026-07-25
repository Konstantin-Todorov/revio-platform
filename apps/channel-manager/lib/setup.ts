import "server-only";
import { reviolinkSetup, type SetupProgress } from "@revio/core";
import { prisma } from "./db";
import { getProperty, getSetupFacts } from "./data";

const PRODUCT = "cm";

/**
 * First-run progress for this property, plus whether the welcome checklist should still be shown.
 *
 * Completion is recorded on the property the first time every step passes, and the card never comes
 * back after that. Without the flag, an established hotel that adds a room type would briefly have
 * an unmapped product again and be greeted with "Welcome to RevioLink" — which would read as the
 * software forgetting who they are. The unmapped count still shows on its KPI, where it belongs.
 */
export async function getSetup(): Promise<SetupProgress & { show: boolean }> {
  const property = await getProperty();
  const progress = reviolinkSetup(await getSetupFacts());
  const alreadyDone = property.setupCompleted.includes(PRODUCT);

  if (progress.complete && !alreadyDone) {
    await prisma.property.update({
      where: { id: property.id },
      data: { setupCompleted: { push: PRODUCT } },
    });
    return { ...progress, show: false };
  }
  return { ...progress, show: !progress.complete && !alreadyDone };
}
