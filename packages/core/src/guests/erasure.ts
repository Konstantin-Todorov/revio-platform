/**
 * Guest data rights — export (Art. 15 / 20) and erasure (Art. 17).
 *
 * ## Why this exists, and why it was urgent
 *
 * The published DPA tells hotels: *"The product lets you find, export, correct and erase a guest
 * record yourself."* Find and correct existed. **Export and erase did not.** That is a contract a
 * hotel's data-protection officer relies on to answer a data-subject request within a month, not a
 * marketing line — and under GDPR the hotel is the controller while we are the processor, so the
 * gap was theirs to be liable for and ours to have created.
 *
 * ## Erasure ANONYMISES, it never deletes
 *
 * Deleting the `Guest` row would be the naive reading of "erase" and it is wrong three ways:
 *
 *  - Reservations carry `guestId`. Removing the guest orphans every stay, and occupancy, ADR and
 *    RevPAR are computed from stays. Erasing one guest would silently rewrite the hotel's history.
 *  - A tax invoice must remain reconcilable to the stay it was issued for.
 *  - Article 17(3)(b) explicitly exempts data held to meet a **legal obligation**. Bulgarian tax law
 *    requires invoices to be kept; erasing the buyer from one would break the hotel's compliance in
 *    the name of the guest's rights.
 *
 * So the row survives with the person removed from it: the stay happened, the revenue is real, and
 * nobody can tell you who it was.
 *
 * ## The copy that gets missed
 *
 * `Reservation.guestName` is a **denormalised copy of the name**, captured at booking so a channel
 * booking has a name before a `Guest` row exists. Anonymising only the `Guest` table leaves the
 * guest's name sitting on every one of their reservations, visible on the front desk and in every
 * export — an erasure that looks complete on the screen you performed it from and nowhere else.
 *
 * ## Notes are deleted, not anonymised
 *
 * `GuestNote.body` and `Reservation.notes` are free text written by staff. There is no way to
 * anonymise a sentence, and these are the rows most likely to hold an opinion about a person. They
 * go.
 *
 * Pure. The caller applies the patch inside one transaction.
 */

/** What a tax document keeps, and the article that permits it. */
export const ERASURE_RETAINED = [
  {
    what: "Tax invoices and credit notes",
    why: "Retained to meet a legal obligation — GDPR Art. 17(3)(b). Bulgarian tax law requires them, and an invoice must stay reconcilable to the stay it was issued for.",
  },
  {
    what: "The reservation itself, without the guest's identity",
    why: "The stay happened and its revenue is part of the hotel's history. Removing it would silently rewrite occupancy and ADR for that period.",
  },
] as const;

export interface ErasableGuest {
  id: string;
  firstName: string;
  lastName: string;
  erasedAt?: Date | null;
}

export type ErasureRefusal = "already-erased" | "merged-record";

export type ErasurePlan =
  | { ok: false; refusal: ErasureRefusal; message: string }
  | {
      ok: true;
      /** Applied to the `Guest` row. */
      guest: {
        firstName: string;
        lastName: string;
        email: null;
        phone: null;
        company: null;
        specialRequests: null;
        emailIsOtaAlias: false;
        erasedAt: Date;
      };
      /** Applied to every `Reservation` carrying this `guestId` — the copy that gets missed. */
      reservation: { guestName: string; notes: null };
      /** `GuestNote` rows for this guest are DELETED. Free text cannot be anonymised. */
      deleteNotes: true;
      /** For the audit line: who was erased, captured before the write. */
      describe: string;
    };

/**
 * The placeholder name.
 *
 * Deliberately not blank and deliberately not "Anonymous". A front-desk list of empty names looks
 * like broken data and invites someone to "fix" it; "Erased guest" says a decision was taken.
 */
export const ERASED_FIRST_NAME = "Erased";
export const ERASED_LAST_NAME = "guest";
export const ERASED_DISPLAY = `${ERASED_FIRST_NAME} ${ERASED_LAST_NAME}`;

export function planGuestErasure(
  guest: ErasableGuest,
  opts: { mergedIntoId?: string | null; now?: Date } = {},
): ErasurePlan {
  if (guest.erasedAt) {
    return {
      ok: false,
      refusal: "already-erased",
      message: "This guest record has already been erased.",
    };
  }
  if (opts.mergedIntoId) {
    // Erasing the loser of a merge would leave the survivor — the record that actually holds the
    // person's data — untouched, and report success. Send them to the survivor instead.
    return {
      ok: false,
      refusal: "merged-record",
      message:
        "This record has been merged into another. Erase the surviving record instead — that is the one holding the guest's data.",
    };
  }

  return {
    ok: true,
    guest: {
      firstName: ERASED_FIRST_NAME,
      lastName: ERASED_LAST_NAME,
      email: null,
      phone: null,
      company: null,
      specialRequests: null,
      // Cleared with the address it described, or the flag outlives the thing it was about.
      emailIsOtaAlias: false,
      erasedAt: opts.now ?? new Date(),
    },
    reservation: { guestName: ERASED_DISPLAY, notes: null },
    deleteNotes: true,
    describe: `${guest.firstName} ${guest.lastName}`.trim(),
  };
}

// --- Export (Art. 15 access / Art. 20 portability) --------------------------

/**
 * Everything held about one guest, in a machine-readable shape.
 *
 * Art. 20 asks for "structured, commonly used and machine-readable", which is JSON — a CSV cannot
 * carry the nesting a stay history has without losing it.
 *
 * It includes what we KEEP as well as what we hold, because an access request that quietly omits the
 * invoices answers the wrong question: the person is entitled to know a tax document with their name
 * on it exists and will be retained.
 */
export interface GuestExportInput {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    emailIsOtaAlias: boolean;
    phone: string | null;
    company: string | null;
    specialRequests: string | null;
    createdAt: Date;
    recognitionOptOut: boolean;
    erasedAt?: Date | null;
  };
  reservations: {
    reference: string | null;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    source: string | null;
    totalMinor: number;
    currency: string;
    notes: string | null;
  }[];
  notes: { author: string | null; body: string; createdAt: Date }[];
  invoices: { number: string; issuedAt: Date | null; grossMinor: number; currency: string }[];
  propertyName: string;
}

export interface GuestExport {
  generatedAt: string;
  subject: { firstName: string; lastName: string; guestId: string };
  property: string;
  /** Plain-language, because the person receiving this is not a developer. */
  about: string;
  contact: Record<string, unknown>;
  stays: unknown[];
  staffNotes: unknown[];
  invoices: unknown[];
  retained: readonly { what: string; why: string }[];
}

export function buildGuestExport(input: GuestExportInput, now: Date = new Date()): GuestExport {
  const g = input.guest;
  return {
    generatedAt: now.toISOString(),
    subject: { firstName: g.firstName, lastName: g.lastName, guestId: g.id },
    property: input.propertyName,
    about:
      "Everything this property holds about you, exported at your request. " +
      "Tax invoices are listed but cannot be deleted — they are kept to meet a legal obligation.",
    contact: {
      email: g.email,
      // Said plainly: the address on file may be the OTA's forwarding address, not theirs, and a
      // person reading their own export should not be left to wonder why it looks unfamiliar.
      emailIsForwardingAddressFromABookingSite: g.emailIsOtaAlias,
      phone: g.phone,
      company: g.company,
      requests: g.specialRequests,
      firstSeen: g.createdAt.toISOString(),
      askedNotToBeRecognisedBetweenStays: g.recognitionOptOut,
      ...(g.erasedAt ? { erasedAt: g.erasedAt.toISOString() } : {}),
    },
    stays: input.reservations.map((r) => ({
      reference: r.reference,
      status: r.status,
      arrival: r.checkIn,
      departure: r.checkOut,
      bookedThrough: r.source,
      total: r.totalMinor / 100,
      currency: r.currency,
      notes: r.notes,
    })),
    staffNotes: input.notes.map((n) => ({
      writtenBy: n.author,
      note: n.body,
      at: n.createdAt.toISOString(),
    })),
    invoices: input.invoices.map((i) => ({
      number: i.number,
      issued: i.issuedAt?.toISOString() ?? null,
      total: i.grossMinor / 100,
      currency: i.currency,
    })),
    retained: ERASURE_RETAINED,
  };
}

/** A filename a person can find again, and that cannot collide across guests or days. */
export function exportFilename(guest: { firstName: string; lastName: string; id: string }, now = new Date()): string {
  const slug = `${guest.firstName}-${guest.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "guest";
  return `${slug}-${guest.id.slice(-6)}-${now.toISOString().slice(0, 10)}.json`;
}
