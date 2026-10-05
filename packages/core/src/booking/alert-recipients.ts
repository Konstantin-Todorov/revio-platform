/**
 * Who hears about a booking made on the hotel's own page.
 *
 * The reservation mailbox when the hotel set one — that is what it is for. Without one the alert used
 * to go nowhere, silently: a guest booked, paid, and the hotel found out when they walked in. So it
 * falls back to the hotel's public contact address, and then to its owners' sign-in addresses — a
 * booking must always reach a person.
 */
export function hotelAlertRecipients(a: {
  primary: string | null | undefined;
  secondary: string | null | undefined;
  contact: string | null | undefined;
  owners: string[];
}): string[] {
  const clean = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.map((x) => (x ?? "").trim().toLowerCase()).filter((x) => /.+@.+\..+/.test(x)))];
  const mailbox = clean([a.primary, a.secondary]);
  if (mailbox.length) return mailbox;
  const contact = clean([a.contact]);
  if (contact.length) return contact;
  return clean(a.owners).slice(0, 3);
}
