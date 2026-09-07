"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";

/**
 * Mark a support request as answered.
 *
 * `handledAt` + `handledById`, the same convention `Lead` uses: null is the working queue, and a
 * timestamp is somebody taking responsibility rather than a row disappearing.
 *
 * Deliberately not a delete and not a status enum. The request stays visible under "Answered"
 * because a renewal call asks what a client has reported before, and a queue that empties itself
 * cannot answer that.
 */
export async function markSupportHandled(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to update the support queue.");

  const id = String(fd.get("id") ?? "");
  if (!id) return flashError("Nothing was selected. Reload the page and try again.");

  // updateMany, so re-marking one that somebody else just handled is a no-op rather than an error.
  const { count } = await forSystem().supportRequest.updateMany({
    where: { id, handledAt: null },
    data: { handledAt: new Date(), handledById: session.userId },
  });

  revalidatePath("/support");
  return setFlash(count > 0 ? "success" : "info", count > 0 ? "Marked as answered." : "Somebody had already answered that one.");
}
