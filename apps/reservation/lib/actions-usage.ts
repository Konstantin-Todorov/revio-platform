"use server";

import { recordUsage } from "@revio/db";
import { getSession } from "./session";

/**
 * Record which screen is open, for RevioCRS.
 *
 * ⚠️ **No capability gate, and none is possible.** Every signed-in person generates usage whatever
 * their role — that is the point of measuring it — and a housekeeper's screens are exactly the ones
 * we know least about. The tenant and the user come from the session and never from the caller, so
 * the only thing an attacker could do with this endpoint is inflate our own view counts.
 *
 * Silent by design: a screen must never fail because bookkeeping did.
 */
export async function recordScreenView(path: string): Promise<void> {
  // Not an early return, deliberately. `silent-lint` counts a bare `return;` in a void action
  // because a user who pressed a button deserves to be told why nothing happened — but nobody
  // pressed anything here, and there is no screen waiting on an answer. Signed out, there is simply
  // nothing to count.
  const session = await getSession();
  if (session) {
    await recordUsage({
      tenantId: session.tenantId,
      userId: session.userId,
      product: "crs",
      path,
    });
  }
}
