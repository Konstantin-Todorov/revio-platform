"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getProperty, remainingByNight, stayViolation, todayInTz, PAYMENT_GUARANTEES } from "./data";
import { releaseExpiredHolds } from "./holds";
import { getSession } from "./session";
import { logAudit, recordPush, str, int, utcDay } from "./mutation-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateReservations() {
  revalidatePath("/reservations");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/guests");
}

function tag(reservationId: string, guestName: string) {
  return `Reservation #${reservationId.slice(-6)} · ${guestName}`;
}

/**
 * Step 1 of Create Reservation: lock the inventory THE MOMENT the room is chosen — before any
 * guest details exist (the spec's overbooking-prevention mechanism). Creates an active Hold with
 * a TTL and sends the agent to the details form; if the form is abandoned, the expiry job frees
 * the rooms.
 */
export async function placeHold(fd: FormData): Promise<void> {
  const property = await getProperty();
  await releaseExpiredHolds();

  const roomTypeId = str(fd, "roomTypeId");
  const checkIn = str(fd, "checkIn");
  const checkOut = str(fd, "checkOut");
  const quantity = Math.max(1, int(fd, "quantity", 1));
  const guests = Math.max(1, int(fd, "guests", 1));
  const sourceId = str(fd, "sourceId");
  const back = `/reservations/new?from=${checkIn}&to=${checkOut}&guests=${guests}&qty=${quantity}${sourceId ? `&src=${sourceId}` : ""}`;

  if (!roomTypeId || !DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    redirect(`${back}&error=${encodeURIComponent("Pick valid arrival and departure dates.")}`);
  }

  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId: property.id } });
  if (!roomType) redirect(back);

  const nights = await remainingByNight(roomTypeId, checkIn, checkOut);
  const short = nights.filter((n) => n.remaining < quantity);
  if (short.length > 0) {
    redirect(`${back}&error=${encodeURIComponent(`${roomType!.name} has no availability on ${short[0]!.date} — pick an alternative.`)}`);
  }

  // Restriction gate (4-level resolution, booking-source-scoped) — a stay that violates a sales
  // rule never reaches the hold stage.
  const source = sourceId ? await prisma.bookingSource.findFirst({ where: { id: sourceId, propertyId: property.id } }) : null;
  const violation = await stayViolation(roomTypeId, checkIn, checkOut, source?.category);
  if (violation) {
    redirect(`${back}&error=${encodeURIComponent(`${roomType!.name}: ${violation}`)}`);
  }

  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const ttlMinutes = defaults?.holdTtlMinutes ?? 30;
  const session = await getSession();

  const hold = await prisma.hold.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      roomTypeId,
      quantity,
      checkIn: utcDay(checkIn),
      checkOut: utcDay(checkOut),
      status: "active",
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      createdById: session?.userId ?? null,
    },
  });

  await logAudit(property.id, property.tenantId, {
    entity: `Hold · ${roomType!.name}`,
    field: "placed",
    newValue: `${checkIn} → ${checkOut} · ${quantity}× · expires in ${ttlMinutes}m`,
  });
  revalidateReservations();
  redirect(`/reservations/new?hold=${hold.id}&guests=${guests}${sourceId ? `&src=${sourceId}` : ""}`);
}

/** Abandon step 2 deliberately — frees the inventory immediately instead of waiting for expiry. */
export async function releaseHold(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const hold = await prisma.hold.findFirst({ where: { id, propertyId: property.id, status: "active" } });
  if (hold) {
    await prisma.hold.update({ where: { id }, data: { status: "released" } });
    revalidateReservations();
  }
  redirect("/reservations/new");
}

/**
 * Step 2: convert the hold into a confirmed reservation. The hold IS the inventory lock, so
 * there is no re-validation race: rooms were already off sale from the moment of selection.
 */
export async function confirmReservation(fd: FormData): Promise<void> {
  const property = await getProperty();
  const session = await getSession();
  await releaseExpiredHolds();

  const holdId = str(fd, "holdId");
  const hold = await prisma.hold.findFirst({
    where: { id: holdId, propertyId: property.id, status: "active", expiresAt: { gt: new Date() } },
    include: { roomType: true },
  });
  if (!hold) {
    redirect(`/reservations/new?error=${encodeURIComponent("This hold has expired — availability was re-opened. Please search again.")}`);
  }

  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const ratePlanId = str(fd, "ratePlanId");
  const bookingSourceId = str(fd, "bookingSourceId");
  const guarantee = PAYMENT_GUARANTEES.some((g) => g.value === str(fd, "paymentGuarantee")) ? str(fd, "paymentGuarantee") : "none";
  const priceMinor = Math.max(0, Math.round(Number(str(fd, "price") || "0") * 100));
  const guestsCount = Math.max(1, int(fd, "guests", 1));
  if (!firstName || !lastName || !ratePlanId) {
    redirect(`/reservations/new?hold=${holdId}&guests=${guestsCount}&error=${encodeURIComponent("Guest name and rate plan are required.")}`);
  }

  const ratePlan = await prisma.ratePlan.findFirst({ where: { id: ratePlanId, propertyId: property.id } });
  const source = bookingSourceId ? await prisma.bookingSource.findFirst({ where: { id: bookingSourceId, propertyId: property.id } }) : null;
  if (!ratePlan) redirect(`/reservations/new?hold=${holdId}&error=${encodeURIComponent("Pick a rate plan.")}`);

  // Guest record: reuse by e-mail when one exists (booking history accumulates), else create.
  const email = str(fd, "email") || null;
  const phone = str(fd, "phone") || null;
  const existing = email ? await prisma.guest.findFirst({ where: { propertyId: property.id, email } }) : null;
  const guest =
    existing ??
    (await prisma.guest.create({
      data: {
        tenantId: property.tenantId,
        propertyId: property.id,
        firstName,
        lastName,
        email,
        phone,
        company: str(fd, "company") || null,
        specialRequests: str(fd, "specialRequests") || null,
      },
    }));
  if (existing && str(fd, "specialRequests")) {
    await prisma.guest.update({ where: { id: existing.id }, data: { specialRequests: str(fd, "specialRequests") } });
  }

  const guestName = `${firstName} ${lastName}`;
  const reservation = await prisma.reservation.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      channelId: null,
      externalId: null,
      guestName,
      status: "confirmed",
      totalMinor: priceMinor,
      currency: property.baseCurrency,
      propertyCurrency: property.baseCurrency,
      propertyTotalMinor: priceMinor,
      fxRate: 1,
      fxAt: new Date(),
      guestId: guest.id,
      bookingSourceId: source?.id ?? null,
      paymentGuarantee: guarantee,
      notes: str(fd, "notes") || null,
      createdById: session?.userId ?? null,
      lines: {
        create: [{
          roomTypeId: hold!.roomTypeId,
          ratePlanId,
          quantity: hold!.quantity,
          checkIn: hold!.checkIn,
          checkOut: hold!.checkOut,
          priceMinor,
          guestsCount,
        }],
      },
    },
  });
  await prisma.hold.update({ where: { id: hold!.id }, data: { status: "converted", reservationId: reservation.id } });

  await logAudit(property.id, property.tenantId, {
    entity: tag(reservation.id, guestName),
    field: "created",
    newValue: `${hold!.roomType.name} · ${hold!.checkIn.toISOString().slice(0, 10)} → ${hold!.checkOut.toISOString().slice(0, 10)} · ${hold!.quantity}× · ${ratePlan!.name}`,
  });
  await recordPush(property.id, property.tenantId, `Reservation created (${guestName}) — availability reduced`);
  revalidateReservations();
  redirect(`/reservations/${reservation.id}`);
}

/**
 * Modification — NEVER an in-place edit of live inventory (spec rule): validate the new stay with
 * the reservation's own line excluded; only if every night still fits does the line change. If
 * validation fails the original reservation is untouched.
 */
export async function modifyReservation(fd: FormData): Promise<void> {
  const property = await getProperty();
  await releaseExpiredHolds();

  const id = str(fd, "id");
  const reservation = await prisma.reservation.findFirst({
    where: { id, propertyId: property.id, status: { in: ["confirmed", "modified", "overbooked"] } },
    include: { lines: true },
  });
  const line = reservation?.lines[0];
  if (!reservation || !line) redirect(`/reservations/${id}`);

  const roomTypeId = str(fd, "roomTypeId") || line!.roomTypeId;
  const checkIn = DATE_RE.test(str(fd, "checkIn")) ? str(fd, "checkIn") : line!.checkIn.toISOString().slice(0, 10);
  const checkOut = DATE_RE.test(str(fd, "checkOut")) ? str(fd, "checkOut") : line!.checkOut.toISOString().slice(0, 10);
  const quantity = Math.max(1, int(fd, "quantity", line!.quantity));
  const priceMinor = Math.max(0, Math.round(Number(str(fd, "price") || String(reservation!.totalMinor / 100)) * 100));
  if (checkOut <= checkIn) {
    redirect(`/reservations/${id}?error=${encodeURIComponent("Departure must be after arrival.")}`);
  }

  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId: property.id } });
  if (!roomType) redirect(`/reservations/${id}`);

  // Validate the NEW stay ignoring this reservation's current line (atomic release→validate).
  const nights = await remainingByNight(roomTypeId, checkIn, checkOut, { reservationId: id });
  const short = nights.filter((n) => n.remaining < quantity);
  if (short.length > 0) {
    redirect(`/reservations/${id}?error=${encodeURIComponent(`No availability for the new stay on ${short[0]!.date} — the reservation was NOT changed.`)}`);
  }

  // Sequential, not $transaction — the RLS proxy forwards model ops only (each already runs in its
  // own tenant-scoped transaction), and the availability validation above is the safety gate.
  const before = `${line!.checkIn.toISOString().slice(0, 10)} → ${line!.checkOut.toISOString().slice(0, 10)} · ${line!.quantity}×`;
  await prisma.reservationLine.update({
    where: { id: line!.id },
    data: { roomTypeId, checkIn: utcDay(checkIn), checkOut: utcDay(checkOut), quantity, priceMinor },
  });
  await prisma.reservation.update({
    where: { id },
    data: { status: "modified", totalMinor: priceMinor, propertyTotalMinor: priceMinor },
  });

  await logAudit(property.id, property.tenantId, {
    entity: tag(id, reservation!.guestName),
    field: "modified",
    oldValue: before,
    newValue: `${roomType!.name} · ${checkIn} → ${checkOut} · ${quantity}×`,
  });
  await recordPush(property.id, property.tenantId, `Reservation modified (${reservation!.guestName}) — availability updated`);
  revalidateReservations();
  revalidatePath(`/reservations/${id}`);
  redirect(`/reservations/${id}`);
}

/** Cancellation restores inventory immediately (sold is derived, so nothing to mutate) + re-push. */
export async function cancelCrsReservation(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const reservation = await prisma.reservation.findFirst({
    where: { id, propertyId: property.id, status: { in: ["confirmed", "modified", "overbooked", "hold"] } },
  });
  if (!reservation) redirect(`/reservations/${id}`);

  await prisma.reservation.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });
  await logAudit(property.id, property.tenantId, {
    entity: tag(id, reservation!.guestName),
    field: "cancelled",
    oldValue: reservation!.status,
    newValue: "cancelled",
  });
  await recordPush(property.id, property.tenantId, `Reservation cancelled (${reservation!.guestName}) — availability restored`);
  revalidateReservations();
  revalidatePath(`/reservations/${id}`);
  redirect(`/reservations/${id}`);
}

/** No-show is only reachable AFTER the check-in date has passed (spec rule). Still counts as
 *  sold in the metrics by default — the room was held. */
export async function markNoShow(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const reservation = await prisma.reservation.findFirst({
    where: { id, propertyId: property.id, status: { in: ["confirmed", "modified"] } },
    include: { lines: true },
  });
  const line = reservation?.lines[0];
  if (!reservation || !line) redirect(`/reservations/${id}`);

  const todayIso = todayInTz(property.timezone);
  if (line!.checkIn.toISOString().slice(0, 10) >= todayIso) {
    redirect(`/reservations/${id}?error=${encodeURIComponent("No-show can only be set after the check-in date has passed.")}`);
  }

  await prisma.reservation.update({ where: { id }, data: { status: "no_show" } });
  await logAudit(property.id, property.tenantId, {
    entity: tag(id, reservation!.guestName),
    field: "no-show",
    oldValue: reservation!.status,
    newValue: "no_show",
  });
  revalidateReservations();
  revalidatePath(`/reservations/${id}`);
  redirect(`/reservations/${id}`);
}

/** Guest contact edits (Guests screen — contact + requests only, not a CRM). */
export async function updateGuest(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const guest = await prisma.guest.findFirst({ where: { id, propertyId: property.id } });
  if (!guest) redirect("/guests");

  await prisma.guest.update({
    where: { id },
    data: {
      firstName: str(fd, "firstName") || guest!.firstName,
      lastName: str(fd, "lastName") || guest!.lastName,
      email: str(fd, "email") || null,
      phone: str(fd, "phone") || null,
      company: str(fd, "company") || null,
      specialRequests: str(fd, "specialRequests") || null,
    },
  });
  revalidatePath(`/guests/${id}`);
  revalidatePath("/guests");
  redirect(`/guests/${id}`);
}
