"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingReference, createPaymentRequest, storedStayTotal } from "@revio/booking";
import { guestPaymentsConfigured, isMockAccount } from "@revio/payments";
import { sendTemplatedEmail } from "@revio/email";
import { stayDetails } from "@revio/core";
import { requireCapability } from "./authz";
import { getProperty } from "./data";
import { prisma } from "./db";
import { logAudit, money, str } from "./mutation-helpers";
import { pressedTwice } from "./submit-once";

const tag = (reservationId: string, guestName: string | null) => `Reservation #${reservationId.slice(-6)} · ${guestName ?? ""}`;

/**
 * Ask the guest to pay — a deposit on a phone booking, the rest of a stay — with a private link to
 * the hotel's own page, where they pay by card on the hotel's Stripe account.
 */
export async function requestGuestPayment(fd: FormData): Promise<void> {
  const session = await requireCapability("manageReservations");
  const property = await getProperty();
  const id = str(fd, "id");
  const back = `/reservations/${id}`;
  // A second press must not send the guest two links for one deposit.
  if (await pressedTwice(fd, property.tenantId, "requestGuestPayment")) redirect(back);
  const amountMinor = money(fd, "amount", 0);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) redirect(`${back}?payLink=amount`);

  const ready = property.stripeChargesEnabled && !!property.stripeAccountId && !isMockAccount(property.stripeAccountId)
    && guestPaymentsConfigured();
  const origin = process.env.BOOKING_ENGINE_ORIGIN?.trim().replace(/\/+$/, "")
    || (process.env.NODE_ENV === "development" ? "http://localhost:3004" : "");
  if (!ready || !property.bookingEngineEnabled || !property.publicSlug || !origin) redirect(`${back}?payLink=notReady`);

  const r = await prisma.reservation.findFirst({
    where: { id, propertyId: property.id },
    include: { guest: true, lines: { include: { roomType: true } } },
  });
  const to = r?.guest?.email?.trim();
  if (!r || !to) redirect(`${back}?payLink=noEmail`);

  const created = await createPaymentRequest(prisma, {
    tenantId: property.tenantId, propertyId: property.id, reservationId: r!.id,
    amountMinor, currency: r!.currency, note: str(fd, "note") || null, createdByName: session.userName ?? null,
  });

  const locale = r!.guestLanguage || property.defaultLanguage || "en";
  const intl = locale === "bg" ? "bg-BG" : "en-GB";
  const fmt = (m: number) => new Intl.NumberFormat(intl, { style: "currency", currency: r!.currency }).format(m / 100);
  const line = r!.lines[0];
  const reference = bookingReference(r!.id);
  const total = await storedStayTotal(prisma, r!.id);
  const sent = await sendTemplatedEmail(prisma, {
    propertyId: property.id,
    key: "payment_request",
    to: [to!],
    locale,
    vars: {
      guestName: r!.guest?.firstName || r!.guestName || "",
      propertyName: property.name,
      reference,
      checkIn: line?.checkIn.toISOString().slice(0, 10) ?? "",
      checkOut: line?.checkOut.toISOString().slice(0, 10) ?? "",
      roomType: line?.roomType.name ?? "",
      amount: fmt(amountMinor),
      note: str(fd, "note") || (locale === "bg" ? "плащане за престоя" : "payment for your stay"),
      deadline: created.expiresAt.toLocaleDateString(intl, { day: "numeric", month: "long" }),
    },
    ...(line ? {
      details: stayDetails({
        locale, reference, roomType: line.roomType.name,
        checkIn: line.checkIn.toISOString().slice(0, 10), checkOut: line.checkOut.toISOString().slice(0, 10),
        checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, guests: line.guestsCount ?? null,
        ...(total ? { totalMinor: total.totalMinor, currency: total.currency } : {}),
      }),
    } : {}),
    cta: { label: locale === "bg" ? `Платете ${fmt(amountMinor)}` : `Pay ${fmt(amountMinor)}`, url: `${origin}/${property.publicSlug}/pay/${created.token}` },
  }).catch(() => ({ ok: false }));
  if (sent.ok) await prisma.paymentRequest.update({ where: { id: created.id }, data: { emailedAt: new Date() } });

  await logAudit(property.id, property.tenantId, {
    entity: tag(r!.id, r!.guestName),
    field: "payment_request",
    newValue: `${fmt(amountMinor)} requested${sent.ok ? " · emailed" : " · email failed"}`,
  });
  revalidatePath(back);
  redirect(`${back}?payLink=${sent.ok ? "sent" : "mailFailed"}`);
}

/** Withdraw a link that has not been paid — the guest then sees it is no longer valid. */
export async function cancelPaymentRequest(fd: FormData): Promise<void> {
  await requireCapability("manageReservations");
  const property = await getProperty();
  const id = str(fd, "requestId");
  const req = await prisma.paymentRequest.findFirst({ where: { id, propertyId: property.id } });
  if (req) await prisma.paymentRequest.updateMany({ where: { id, status: "open" }, data: { status: "cancelled" } });
  redirect(`/reservations/${req?.reservationId ?? ""}`);
}
