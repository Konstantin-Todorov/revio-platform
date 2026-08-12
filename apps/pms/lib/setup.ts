import "server-only";
import { reviopmsSetup, SETUP_KEY, hasFinishedSetup, type SetupProgress } from "@revio/core";
import { prisma } from "./db";
import { activeProperty, getSetupFacts } from "./data";

const PRODUCT = "RevioPMS" as const;

/** First-run progress + whether to show the welcome checklist. See the RevioLink copy of this file
 *  for why completion is recorded once and never re-shown. */
export async function getSetup(): Promise<SetupProgress & { show: boolean }> {
  const { property } = await activeProperty();
  const progress = reviopmsSetup(await getSetupFacts());
  const alreadyDone = hasFinishedSetup(property.setupCompleted, PRODUCT);

  if (progress.complete && !alreadyDone) {
    // Guarded in the WHERE clause, not in JS: two dashboard loads racing each other would otherwise
    // both see "not marked" and push the key twice.
    await prisma.property.updateMany({
      where: { id: property.id, NOT: { setupCompleted: { has: SETUP_KEY[PRODUCT] } } },
      data: { setupCompleted: { push: SETUP_KEY[PRODUCT] } },
    });
    return { ...progress, show: false };
  }
  return { ...progress, show: !progress.complete && !alreadyDone };
}
