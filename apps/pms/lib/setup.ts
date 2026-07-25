import "server-only";
import { reviopmsSetup, type SetupProgress } from "@revio/core";
import { prisma } from "./db";
import { activeProperty, getSetupFacts } from "./data";

const PRODUCT = "pms";

/** First-run progress + whether to show the welcome checklist. See the RevioLink copy of this file
 *  for why completion is recorded once and never re-shown. */
export async function getSetup(): Promise<SetupProgress & { show: boolean }> {
  const { property } = await activeProperty();
  const progress = reviopmsSetup(await getSetupFacts());
  const alreadyDone = property.setupCompleted.includes(PRODUCT);

  if (progress.complete && !alreadyDone) {
    await prisma.property.update({ where: { id: property.id }, data: { setupCompleted: { push: PRODUCT } } });
    return { ...progress, show: false };
  }
  return { ...progress, show: !progress.complete && !alreadyDone };
}
