"use server";

import { revalidatePath } from "next/cache";
import { resolveAppError } from "@revio/db";
import { getOperatorSession } from "./session";

/**
 * Mark an unhandled fault as dealt with.
 *
 * Not a fix and not a delete — `recordAppError` clears `resolvedAt` the moment the same signature is
 * seen again. Resolving says "I have looked at this"; the fault itself decides whether that was true.
 */
export async function resolveAppErrorAction(fd: FormData): Promise<void> {
  if (!(await getOperatorSession())) return;
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return;
  await resolveAppError(id);
  revalidatePath("/health");
}
