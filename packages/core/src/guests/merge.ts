import { hydrateGuestContact, isOtaAliasEmail, type ContactPatch } from "./contact-hydration.js";

/**
 * Collapsing two records that are the same person — the matching rules and the merge arithmetic.
 *
 * Extracted from `apps/pms/lib/` when the CRS needed it too, which is this platform's rule: a thing
 * moves to a package at the moment a **second caller appears**, never speculatively. The PMS version
 * was correct about what to do and had four problems that only show up under load or under failure,
 * all of which are fixed by the move — see the notes on each function.
 *
 * ## Why identity is foundational rather than a tidying feature
 *
 * The same person arrives as "Ventsi Mukov" from Booking.com, "V. Mukov" from a walk-in and
 * "ventsi@..." from the booking engine. Left alone, that is three guests: repeat-stay counts are
 * wrong, lifetime value is divided by three, and "returning guest" never fires for the person it
 * most matters to. Every guest metric in every product rests on this.
 *
 * ## A merge is soft, always
 *
 * The loser is re-parented and flagged, never deleted. Its id stays resolvable, because that id is
 * in confirmation emails, in an OTA's records and possibly on a printed invoice. Deleting rows to
 * tidy a list is how a support question becomes unanswerable.
 *
 * Pure. Rows in, decisions out.
 */

export interface MergeableGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailIsOtaAlias?: boolean;
  phone: string | null;
  company?: string | null;
  mergedIntoId?: string | null;
}

/** Why we think these two are the same person. Ordered strongest first. */
export type DuplicateReason = "email" | "phone" | "name";

export interface DuplicateCandidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reason: DuplicateReason;
}

const REASON_RANK: Record<DuplicateReason, number> = { email: 0, phone: 1, name: 2 };

export function normaliseName(first: string, last: string): string {
  return `${first} ${last}`.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * A comparison key for a phone number.
 *
 * ⚠️ Digits-only is not enough, and the naive version shipped in the PMS. The SAME number reaches us
 * written three ways — `+359 88 812 34 56` from the booking engine, `00359888123456` from an OTA,
 * `0888123456` typed at the front desk — and stripping non-digits leaves three different strings
 * (`359888123456`, `00359888123456`, `0888123456`). They would never match, which is precisely the
 * duplicate this feature exists to catch.
 *
 * So the key is the last `PHONE_KEY_DIGITS` digits, which is what survives every prefix convention:
 * international `+`, the `00` form, and a national leading zero all fall away and the subscriber
 * number remains.
 *
 * The trade-off, stated: two numbers from different countries sharing their last nine digits will
 * collide. Within one property that is vanishingly rare, and the consequence is a *candidate offered
 * to a human*, never an automatic merge. Under-matching would be the worse failure — it is silent.
 */
export const PHONE_KEY_DIGITS = 9;

export function normalisePhone(p: string | null | undefined): string {
  const digits = (p ?? "").replace(/\D/g, "");
  return digits.length > PHONE_KEY_DIGITS ? digits.slice(-PHONE_KEY_DIGITS) : digits;
}

/**
 * A phone shorter than this is an extension or a fragment, not an identity.
 *
 * Matching on "123" would merge unrelated guests, and a wrong merge is far more expensive than a
 * missed one: it folds two people's stay histories together and there is no clean way back.
 */
export const MIN_PHONE_DIGITS = 6;

/**
 * Which of `candidates` look like the same person as `subject`.
 *
 * ⚠️ **An OTA alias never matches on email.** Two guests of the same hotel can hold
 * `abc@guest.booking.com` and `xyz@guest.booking.com`; those are different people. Worse, some
 * channels reuse a relay address across bookings, so an exact match on one proves nothing at all.
 * The PMS version did not know about aliases — it predates the flag — and would happily have offered
 * two unrelated guests as duplicates on the strongest signal it has.
 */
export function matchDuplicates(
  subject: MergeableGuest,
  candidates: readonly MergeableGuest[],
): DuplicateCandidate[] {
  const email = subject.email?.toLowerCase().trim() || null;
  const emailUsable = email !== null && !subject.emailIsOtaAlias && !isOtaAliasEmail(email);
  const phone = normalisePhone(subject.phone);
  const name = normaliseName(subject.firstName, subject.lastName);

  const out: DuplicateCandidate[] = [];
  for (const c of candidates) {
    if (c.id === subject.id || c.mergedIntoId) continue;

    const cEmail = c.email?.toLowerCase().trim() || null;
    const cEmailUsable = cEmail !== null && !c.emailIsOtaAlias && !isOtaAliasEmail(cEmail);

    let reason: DuplicateReason | null = null;
    if (emailUsable && cEmailUsable && cEmail === email) reason = "email";
    else if (phone.length >= MIN_PHONE_DIGITS && normalisePhone(c.phone) === phone) reason = "phone";
    else if (name && normaliseName(c.firstName, c.lastName) === name) reason = "name";

    if (reason) {
      out.push({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        reason,
      });
    }
  }
  return out.sort((a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || a.name.localeCompare(b.name));
}

export type MergeRefusal =
  | "same-record"
  | "winner-already-merged"
  | "loser-already-merged";

export type MergePlan =
  | { ok: false; refusal: MergeRefusal }
  | {
      ok: true;
      winnerId: string;
      loserId: string;
      /** Contact fields to copy up. Empty when the winner already has everything. */
      fill: ContactPatch;
      /** For the audit line — captured before the write, since the loser changes. */
      describe: { winner: string; loser: string };
    };

/**
 * Decide what a merge should do, without doing it.
 *
 * The refusals are the interesting part. Merging into an already-merged record produces a chain
 * (`a → b → c`) that every reader then has to walk, and one loop makes them hang; refusing keeps the
 * pointer one hop deep forever. Callers should resolve to the survivor first and merge into *that*.
 *
 * The contact fill reuses `hydrateGuestContact`, so a merge and a booking enrich a profile by exactly
 * the same rule — enrich empty, never overwrite. The PMS had a second hand-written copy of that rule,
 * which is how two rules drift.
 */
export function planMerge(winner: MergeableGuest, loser: MergeableGuest): MergePlan {
  if (winner.id === loser.id) return { ok: false, refusal: "same-record" };
  if (winner.mergedIntoId) return { ok: false, refusal: "winner-already-merged" };
  if (loser.mergedIntoId) return { ok: false, refusal: "loser-already-merged" };

  const fill = hydrateGuestContact(
    { email: winner.email, phone: winner.phone, company: winner.company ?? null },
    { email: loser.email, phone: loser.phone, company: loser.company ?? null },
  );

  return {
    ok: true,
    winnerId: winner.id,
    loserId: loser.id,
    fill,
    describe: {
      winner: `${winner.firstName} ${winner.lastName}`.trim(),
      loser: `${loser.firstName} ${loser.lastName}`.trim(),
    },
  };
}

export const MERGE_REFUSAL_MESSAGE: Record<MergeRefusal, string> = {
  "same-record": "That is the same guest.",
  "winner-already-merged":
    "The guest you are merging into has itself been merged into another record. Open that one and merge there.",
  "loser-already-merged": "That guest has already been merged into another record.",
};

/**
 * Which of two records should survive.
 *
 * A suggestion for the UI to preselect, never an automatic decision — a person confirms the merge,
 * because getting it wrong buries the record a hotel actually uses. Ranked by how much a human has
 * invested in the record: a real email beats an OTA relay, more contact detail beats less, and older
 * beats newer as the tiebreak, since the older record is the one already referenced elsewhere.
 */
export function suggestWinner<T extends MergeableGuest & { createdAt: Date }>(a: T, b: T): T {
  const score = (g: T) =>
    (g.email && !g.emailIsOtaAlias && !isOtaAliasEmail(g.email) ? 4 : 0) +
    (g.email ? 1 : 0) +
    (g.phone ? 2 : 0) +
    (g.company ? 1 : 0);
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sa > sb ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
}
