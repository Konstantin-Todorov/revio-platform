"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { logAudit, str } from "./mutation-helpers";
import { runCloseDay } from "./close-day-run";

/**
 * Session + capability gate for every action in this file.
 *
 * The nav and the layout route-guard hide screens from scoped roles, but neither stops a WRITE:
 * Next runs a server action first and re-renders (re-guards) afterwards, so a crafted POST from a
 * housekeeper or outlet account would otherwise commit before the guard ever fired. Denial
 * redirects the caller to their own home screen, so nothing downstream in the action runs.
 */
async function ctx(cap: Capability) {
  const session = await getSession();
  if (!session) throw new Error("No session");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
  return session;
}

/** Mark a single un-arrived reservation as a no-show (never checked in). */
export async function markNoShow(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");
  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: session.activePropertyId },
    include: { assignments: true },
  });
  if (!res || res.assignments.length > 0) redirect("/closeday"); // arrived guests aren't no-shows
  await prisma.reservation.update({ where: { id: reservationId }, data: { status: "no_show" } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "no_show", field: res.guestName, newValue: "marked no-show", userId: session.userId });
  revalidatePath("/closeday");
  revalidatePath("/dashboard");
}

/** The manual "Close Day" button. A human is present, so they have already read the warnings. */
export async function closeDay(): Promise<void> {
  const session = await ctx("manage");
  const outcome = await runCloseDay(session.tenantId, session.activePropertyId, {
    kind: "user",
    userId: session.userId,
  });
  if (!outcome) redirect("/closeday");
  revalidatePath("/closeday");
  revalidatePath("/dashboard");
  redirect(`/closeday?closed=${outcome!.noShows}`);
}
