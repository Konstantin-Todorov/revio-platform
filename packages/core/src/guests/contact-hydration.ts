/**
 * Filling in a guest's contact details from a new booking — F4, spec §4.5.
 *
 * The profile is the canonical record, so it enriches itself from bookings. Three rules, decided by
 * the founder and not to be varied without saying so:
 *
 *   1. **Enrich empty** — a blank field is filled from a booking that carries a value.
 *   2. **Never overwrite** — a value already on the profile was confirmed by a person and outranks
 *      anything derived. This is the rule that makes the feature safe to run automatically.
 *   3. **Tag OTA-sourced email as an alias** — see below.
 *
 * ## The case that made this real
 *
 * A guest books direct, giving name, email and phone. `public-engine.ts` matches them by email, finds
 * the existing profile, and **throws the phone away** — because the match short-circuits to the
 * existing row and nothing merges the newly supplied values into it. A guest who has stayed twice can
 * have typed their phone number both times and still have a blank phone on file.
 *
 * ## Why an OTA email is not ground truth
 *
 * Booking.com and the other OTAs do not give you the guest's address. They give you a **masked relay**
 * — `abc123@guest.booking.com` — which forwards while the booking is live and stops afterwards. It is
 * fine for messaging and useless as an identity: it will not reach the guest next year, it must never
 * be merged into a marketing list, and two different people can hold visually similar ones.
 *
 * So it is stored (a hotel needs to message the guest) and **flagged**, so no screen presents it as
 * the guest's own address. Untagged, a hotel emails a dead relay believing it reached someone.
 *
 * Pure — no DB. The caller applies the patch.
 */

export interface GuestContact {
  email: string | null;
  phone: string | null;
  company?: string | null;
}

export interface IncomingContact {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

/** Only the fields that should change. Empty object means nothing to do — do not issue a write. */
export interface ContactPatch {
  email?: string;
  phone?: string;
  company?: string;
  emailIsOtaAlias?: boolean;
}

/**
 * Domains an OTA uses for a masked relay address.
 *
 * Matched on the domain SUFFIX so a subdomain is caught too — Booking.com has used both
 * `guest.booking.com` and per-property subdomains under it. A list rather than a clever heuristic:
 * a false positive here tells a hotel their guest's real address is fake, which is worse than
 * missing one.
 */
const OTA_ALIAS_DOMAINS = [
  "guest.booking.com",
  "m.expediapartnercentral.com",
  "expediapartnercentral.com",
  "guest.airbnb.com",
  "airbnb.com",
  "message.airbnb.com",
  "guest.agoda.com",
  "agoda-messaging.com",
  "partners.expediagroup.com",
  "stay.trip.com",
  "relay.hotelbeds.com",
] as const;

export function isOtaAliasEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return OTA_ALIAS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Blank, whitespace-only and null are all "empty". A field of spaces is not a confirmed value. */
function isEmpty(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

/**
 * What to write to the profile, given what it holds and what the booking supplied.
 *
 * Returns only changed fields, so the caller can skip the write entirely when nothing moved — a
 * guest booking their fourth stay with the same details should not produce an UPDATE, an audit row
 * and a modified timestamp.
 */
export function hydrateGuestContact(existing: GuestContact, incoming: IncomingContact): ContactPatch {
  const patch: ContactPatch = {};

  const email = incoming.email?.trim().toLowerCase();
  if (email && isEmpty(existing.email)) {
    patch.email = email;
    // Recorded at the moment it is learned. Deriving it later means re-testing the domain list on
    // every read, and the answer would change when the list does.
    patch.emailIsOtaAlias = isOtaAliasEmail(email);
  }

  const phone = incoming.phone?.trim();
  if (phone && isEmpty(existing.phone)) patch.phone = phone;

  const company = incoming.company?.trim();
  if (company && isEmpty(existing.company)) patch.company = company;

  return patch;
}

export function hasChanges(patch: ContactPatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * What to show beside an address that is a relay.
 *
 * Deliberately plain and slightly blunt: the hotelier has to understand this is not the guest's
 * address before they use it, and "OTA alias" alone does not convey that it stops working.
 */
export const OTA_ALIAS_NOTE =
  "Forwarding address from the OTA — reaches the guest while the booking is live, not afterwards.";
