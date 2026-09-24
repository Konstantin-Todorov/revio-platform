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

import { renderSystemEmail, renderSystemEmailText, type SystemEmailLocale } from "./system-shell.js";
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
  /** The hotel team's language (`teamLocale` in @revio/db). English otherwise. */
  locale?: string;
}

/** The copy, one entry per language — a new language is a new entry, never a branch. */
const COPY: Record<SystemEmailLocale, (a: ImportFailureArgs) => { subject: string; preview: string; heading: string; lead: string; labels: [string, string, string, string]; why: string; action: string; calm: string; note: string }> = {
  en: (a) => ({
    subject: `Action needed — a ${a.channelName} booking is not in your calendar`,
    preview: `${a.channelName} confirmed a booking we could not add to your calendar — the room is still on sale.`,
    heading: "A booking is not in your calendar",
    lead:
      `${a.channelName} has confirmed a booking to a guest, and ${a.hotelName} does not yet have a ` +
      `stay for it. Two things follow: nobody is holding that room, so it can still be sold ` +
      `again — and the guest believes they have it.`,
    labels: ["Guest", "Reference", "Total", "Sold as"],
    why:
      `The room type or rate plan it was sold under is not mapped for ${a.channelName} yet, so we ` +
      `could not tell which of your rooms it meant. We did not guess — guessing is how two ` +
      `guests arrive for one room.`,
    action: "Finish the mapping",
    calm:
      `Nothing has been lost. Once the mapping is finished, press "Re-import bookings" on the ` +
      `Channels screen and it comes in with its dates and guest details. ` +
      `(Re-sync only sends prices out — it will not bring a booking back.)`,
    note: "You are getting this because a booking arrived that we could not write down. It is not a routine notification.",
  }),
  bg: (a) => ({
    subject: `Нужно е действие — резервация от ${a.channelName} не е в календара Ви`,
    preview: `${a.channelName} потвърди резервация, която не успяхме да добавим в календара Ви — стаята все още се продава.`,
    heading: "Резервация не е в календара Ви",
    lead:
      `${a.channelName} потвърди резервация на гост, а ${a.hotelName} все още няма престой за нея. ` +
      `От това следват две неща: никой не пази тази стая, така че тя може да бъде продадена отново — ` +
      `а гостът смята, че я има.`,
    labels: ["Гост", "Номер", "Сума", "Продадена като"],
    why:
      `Типът стая или ценовият план, по който е продадена, още не е свързан за ${a.channelName}, така че ` +
      `не можахме да разберем коя от стаите Ви е. Не гадаехме — от гадаене двама гости пристигат за една стая.`,
    action: "Довършете свързването",
    calm:
      `Нищо не е загубено. Щом свързването е готово, натиснете „Повторно изтегляне на резервациите“ в ` +
      `екрана „Канали“ и резервацията влиза с датите и данните на госта. ` +
      `(Повторната синхронизация само изпраща цени — тя няма да върне резервация.)`,
    note: "Получавате това, защото пристигна резервация, която не успяхме да запишем. Това не е рутинно известие.",
  }),
};

export function importFailureEmail(a: ImportFailureArgs): AuthEmail {
  const locale: SystemEmailLocale = a.locale === "bg" ? "bg" : "en";
  const c = COPY[locale](a);
  const args = {
    locale,
    preview: c.preview,
    heading: c.heading,
    blocks: [
      { p: c.lead },
      {
        list: [
          `${c.labels[0]} · ${a.guestName}`,
          `${c.labels[1]} · ${a.reference}`,
          `${c.labels[2]} · ${a.total}`,
          ...(a.unmapped ? [`${c.labels[3]} · ${a.unmapped}`] : []),
        ],
      },
      { p: c.why },
      { action: { label: c.action, url: a.mappingUrl } },
      // The reassurance is load-bearing: the hotel that hit this disconnected its channel because
      // it believed bookings were being dropped.
      { p: c.calm },
      { note: c.note },
    ],
  };
  return { subject: c.subject, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}
