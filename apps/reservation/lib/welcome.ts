import "server-only";
import { getWelcomeFacts } from "@revio/db";
import type { WelcomeFacts } from "@revio/core";
import { prisma } from "./db";
import { getProperty } from "./data";

/**
 * What the shared core already holds for this hotel — the input to `welcomeFlow`.
 *
 * The query lives in `@revio/db` because all three products need the identical answer and apps may
 * never import one another. For a hotel that already runs RevioLink this is what turns a six-screen
 * setup into three.
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
    "RevioCRS",
  );
}
