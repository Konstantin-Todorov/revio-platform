/**
 * The email a hotel gets when a channel sold a room and we could not write the booking down.
 *
 * ## Why this exists
 *
 * On 2026-09-15 a real hotel connected its property, made a test booking to watch it arrive, and
 * received **nothing**. The booking had been sold under a rate plan with no external id, so
 * RevioLink refused to guess which room it meant — correctly; guessing is how two guests end up in
 * one room — and parked it. It wrote a clear Sync Center line and a critical Error Center entry, and
 * the owner saw neither, because she was watching her inbox.
 *
 * She waited fifteen minutes, concluded bookings were being lost, and disconnected her channel.
 *
 * ⚠️ **Silence was the defect.** Every other part of the refusal was right. A booking that a channel
 * has already confirmed to a guest, which this platform is now NOT holding a room for, is the single
 * event most worth interrupting somebody about — and it was the only one that sent no mail at all.
 *
 * ## What it leads with
 *
 * The consequence, not the cause. "Your channel mapping is incomplete" is a description of our
 * problem; "this booking is not in your calendar and the room is still on sale" is a description of
 * theirs, and it is the sentence that makes somebody act today.
 *
 * ⚠️ It must never read as an apology for losing a booking. Nothing is lost — the booking is held
 * until the mapping is finished — and a hotel that believes we drop bookings disconnects the
 * channel, which is exactly what happened.
 */

import { renderSystemEmail, renderSystemEmailText } from "./system-shell.js";
import type { AuthEmail } from "./auth-emails.js";

export interface ImportFailureArgs {
  hotelName: string;
  /** "Booking.com", "Airbnb" — the channel as the hotel knows it, not our internal code. */
  channelName: string;
  guestName: string;
  /** The booking reference the channel uses, so it can be found on their extranet. */
  reference: string;
  /** Formatted by the caller, in the property's own currency. */
  total: string;
  /**
   * What could not be resolved, in the channel's own ids — "room 5b6c… · rate 0ea3… (2026-09-20 →
   * 2026-09-22)". Empty when even that is unknown, which should not happen but must not crash a
   * mail that is already about something going wrong.
   */
  unmapped: string;
  /** Straight to the mapping screen. Built by the caller — only it knows its own origin. */
  mappingUrl: string;
}

export function importFailureEmail({
  hotelName,
  channelName,
  guestName,
  reference,
  total,
  unmapped,
  mappingUrl,
}: ImportFailureArgs): AuthEmail {
  const args = {
    preview: `${channelName} confirmed a booking we could not add to your calendar — the room is still on sale.`,
    heading: "A booking is not in your calendar",
    blocks: [
      {
        p:
          `${channelName} has confirmed a booking to a guest, and ${hotelName} does not yet have a ` +
          `stay for it. Two things follow: nobody is holding that room, so it can still be sold ` +
          `again — and the guest believes they have it.`,
      },
      {
        list: [
          `Guest · ${guestName}`,
          `Reference · ${reference}`,
          `Total · ${total}`,
          ...(unmapped ? [`Sold as · ${unmapped}`] : []),
        ],
      },
      {
        p:
          `The room type or rate plan it was sold under is not mapped for ${channelName} yet, so we ` +
          `could not tell which of your rooms it meant. We did not guess — guessing is how two ` +
          `guests arrive for one room.`,
      },
      { action: { label: "Finish the mapping", url: mappingUrl } },
      {
        // The reassurance is load-bearing: the hotel that hit this disconnected its channel because
        // it believed bookings were being dropped.
        p:
          `Nothing has been lost. The booking is held, and re-syncing after the mapping is finished ` +
          `brings it in with its dates and guest details. Until then it sits in your Error Center.`,
      },
      { note: "You are getting this because a booking arrived that we could not write down. It is not a routine notification." },
    ],
  };

  return {
    subject: `Action needed — a ${channelName} booking is not in your calendar`,
    text: renderSystemEmailText(args),
    html: renderSystemEmail(args),
  };
}
