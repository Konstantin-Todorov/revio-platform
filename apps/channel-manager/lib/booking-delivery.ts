import "server-only";
import { forSystem, teamLocale } from "@revio/db";
import { newBookingsEmail } from "@revio/core";
import { sendEmail, deliveryRecipients } from "@revio/email";

/**
 * "You have N new bookings" — to a hotel that runs RevioLink alone, after ANY import.
 *
 * ## Why one function
 *
 * Bookings arrive three ways: the five-minute pull, the pull a person presses, and the Channex
 * webhook that rings seconds after the booking. The first two each built their own email (worded
 * differently for the same event) and the third built none at all — and because the webhook imports
 * first, the scheduled pull then found nothing new, so **a RevioLink-only hotel with the webhook on
 * was never told about a single booking**. Found on 2026-09-25 while checking that no guest or
 * team email is sent twice or not at all. One function, called from all three, is the fix.
 *
 * ## Why only RevioLink-alone
 *
 * A hotel running RevioCRS or RevioPMS sees every booking there, on the screen it already works
 * from; mailing it too would be the duplicate. RevioLink alone has nowhere else to show them.
 *
 * Never throws — the booking is already imported, and the mail is the softer half.
 */
export async function deliverNewBookings(channelId: string, imported: number): Promise<{ sent: boolean; to: string[]; note: string }> {
  if (imported <= 0) return { sent: false, to: [], note: "nothing new" };
  try {
    const db = forSystem();
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      include: { property: { include: { tenant: { select: { hasReservation: true, hasPms: true } } } } },
    });
    if (!channel) return { sent: false, to: [], note: "channel gone" };
    const { property } = channel;
    if (property.tenant.hasReservation || property.tenant.hasPms) return { sent: false, to: [], note: "shown in RevioCRS/RevioPMS" };
    const to = deliveryRecipients(property, "both");
    if (to.length === 0) return { sent: false, to, note: "no delivery address" };

    const fresh = await db.reservation.findMany({
      where: { propertyId: property.id, channelId },
      include: { channel: true, lines: { include: { roomType: true } } },
      orderBy: { importedAt: "desc" },
      take: imported,
    });
    const mail = newBookingsEmail({
      locale: await teamLocale(property.tenantId, to),
      hotel: property.name,
      channel: channel.name,
      rows: fresh.map((r) => {
        const l = r.lines[0];
        return {
          guest: r.guestName, room: l?.roomType.name ?? "",
          checkIn: l ? l.checkIn.toISOString().slice(0, 10) : "", checkOut: l ? l.checkOut.toISOString().slice(0, 10) : "",
          channel: r.channel?.name ?? null, reference: r.externalId ?? r.id.slice(-6),
          total: `${(r.totalMinor / 100).toFixed(2)} ${r.currency}`,
        };
      }),
    });
    const res = await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html });
    return { sent: res.ok, to, note: res.ok ? `${fresh.length} emailed (${res.mode})` : `failed: ${res.error ?? "unknown"}` };
  } catch (e) {
    return { sent: false, to: [], note: `failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
