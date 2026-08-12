import "server-only";
import { getWelcomeFacts } from "@revio/db";
import type { WelcomeFacts } from "@revio/core";
import { prisma } from "./db";
import { getProperty } from "./data";

/**
 * What the shared core already holds for this hotel — the input to `welcomeFlow`.
 *
 * A thin wrapper so every caller in this app (the page, each action's `advance`) reads the same
 * facts through the same tenant-scoped client. The query itself lives in `@revio/db` because all
 * three products need the identical answer and apps may never import one another.
 */
export async function getWelcomeFactsForProperty(): Promise<WelcomeFacts> {
  const property = await getProperty();
  return getWelcomeFacts(
    prisma,
    property.id,
    {
      hasChannelManager: property.tenant.hasChannelManager,
      hasReservation: property.tenant.hasReservation,
      hasPms: property.tenant.hasPms,
    },
    "RevioLink",
  );
}
