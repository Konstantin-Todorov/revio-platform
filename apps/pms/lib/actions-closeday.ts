"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { logAudit, recordSync, str } from "./mutation-helpers";
import { accrueStayExtras } from "./folio";
import { todayInTz, addDaysYmd, utcDay, ymd } from "./format";

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
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}

/**
 * Close the business day (manual night audit): auto-mark every un-arrived reservation whose arrival is
 * on/before the business date as a no-show, then roll the property's business date forward one day.
 * (Full nightly accommodation posting isn't needed — folios post the whole stay up front.)
 */
export async function closeDay(): Promise<void> {
  const session = await ctx("manage");
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

  // Recurring stay extras (breakfast, parking…) accrue for the night being closed (spec §3.6).
  // Idempotent per (extra, date), so re-closing a day never double-charges.
  const accrued = await accrueStayExtras(session.tenantId, session.activePropertyId, businessDate);

  const next = addDaysYmd(businessDate, 1);
  await prisma.property.update({ where: { id: property!.id }, data: { businessDate: utcDay(next) } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "close_day", field: businessDate, newValue: `${noShows} no-show(s) · ${accrued} extra(s) accrued · rolled to ${next}`, userId: session.userId });
  // Boundary rule: the close itself is operational (audit above). Only its availability effect
  // (no-show rooms released back to sale) is channel-facing.
  if (noShows > 0) {
    await recordSync(session.activePropertyId, session.tenantId, "Availability restored — no-show rooms released", `${noShows} room(s) returned to sale`);
  }
  revalidatePath("/closeday");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
  redirect(`/closeday?closed=${noShows}`);
}
