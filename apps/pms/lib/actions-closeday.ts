"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { logAudit, recordSync, str } from "./mutation-helpers";
import { todayInTz, addDaysYmd, utcDay, ymd } from "./format";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

/** Mark a single un-arrived reservation as a no-show (never checked in). */
export async function markNoShow(fd: FormData): Promise<void> {
  const session = await ctx();
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

/**
 * Close the business day (manual night audit): auto-mark every un-arrived reservation whose arrival is
 * on/before the business date as a no-show, then roll the property's business date forward one day.
 * (Full nightly accommodation posting isn't needed — folios post the whole stay up front.)
 */
export async function closeDay(): Promise<void> {
  const session = await ctx();
  const property = await prisma.property.findUnique({ where: { id: session.activePropertyId } });
  if (!property) redirect("/closeday");
  const today = todayInTz(property!.timezone);
  const businessDate = property!.businessDate ? ymd(property!.businessDate) : today;

  const reservations = await prisma.reservation.findMany({
    where: { propertyId: property!.id, status: { in: ["confirmed", "modified"] } },
    include: { lines: true, assignments: true },
  });
  let noShows = 0;
  for (const r of reservations) {
    if (r.assignments.length > 0 || r.lines.length === 0) continue; // arrived, or no stay
    const ci = ymd(r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!);
    if (ci <= businessDate) {
      await prisma.reservation.update({ where: { id: r.id }, data: { status: "no_show" } });
      noShows++;
    }
  }

  const next = addDaysYmd(businessDate, 1);
  await prisma.property.update({ where: { id: property!.id }, data: { businessDate: utcDay(next) } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "close_day", field: businessDate, newValue: `${noShows} no-show(s) · rolled to ${next}`, userId: session.userId });
  await recordSync(session.activePropertyId, session.tenantId, `Day closed — ${businessDate}`, `${noShows} no-show(s) · business date rolled to ${next}`);
  revalidatePath("/closeday");
  revalidatePath("/dashboard");
  redirect(`/closeday?closed=${noShows}`);
}
