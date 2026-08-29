"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { getOperatorSession } from "./session";

/**
 * Mark a demo request as dealt with — the only state a lead has.
 *
 * Deliberately a toggle and not a status pipeline. A lead is either still owed a reply or it is not;
 * inventing "contacted / qualified / nurturing" here would be a CRM nobody asked for, and the
 * relationship record for anyone who becomes a customer already exists as `ClientAccount`.
 */
export async function setLeadHandled(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return;

  const id = String(fd.get("id") ?? "");
  const handled = String(fd.get("handled") ?? "") === "1";
  if (!id) return;

  await forSystem().lead.update({
    where: { id },
    data: handled
      ? { handledAt: new Date(), handledById: session.userId }
      : { handledAt: null, handledById: null },
  });

  revalidatePath("/leads");
}
