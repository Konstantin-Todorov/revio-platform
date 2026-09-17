import { isDisposableEmail } from "@revio/core";
/**
 * What needs looking at, per client — the difference between a dashboard and a console.
 *
 * The console already counted things: hotels, properties, reservations, open errors. Counts tell you
 * the platform is alive; they do not tell you which customer to call this morning. Running the
 * business means seeing exceptions, and an exception is a *derived* fact — "bought RevioPMS six weeks
 * ago and has never created a room" is not a number on any screen today.
 *
 * The rules live here, pure and tested, for two reasons. They will be argued with (every threshold
 * below is a judgement, and the right value is learned from real customers), and they are the kind of
 * logic that rots quietly when it is spread across JSX.
 *
 * **Severity means "how soon", not "how bad".** `act` is something losing money or trust right now.
 * `soon` is a customer drifting toward churn. `note` is context you would want before a call but
 * would not interrupt your day for. Anything that cannot be acted on is not a flag at all — a console
 * that cries wolf gets ignored, which is worse than one that says nothing.
 */

export type Severity = "act" | "soon" | "note";

export interface AttentionFlag {
  severity: Severity;
  /** Short label — reads as the problem, not the metric. */
  title: string;
  /** One sentence a human can act on. */
  detail: string;
}

export interface ClientSignals {
  status: string; // active | suspended
  createdAt: Date;
  entitlements: { channelManager: boolean; reservation: boolean; pms: boolean };
  properties: number;
  roomTypes: number;
  units: number;
  /**
   * The owner's email address, so a temporary mailbox can be noticed.
   *
   * ⚠️ Null when there is no owner with an address — never an empty string, which would read as
   * "an address that is not disposable" and quietly answer a question nobody asked.
   */
  ownerEmail: string | null;
  channels: number;
  channelsConnected: number;
  openErrors: number;
  lastSyncAt: Date | null;
  /** Newest reservation from any source, or null if the client has never taken one. */
  lastReservationAt: Date | null;
  reservationsLast30d: number;
  bookingEngineProperties: number;
  directReservationsLast30d: number;
  /** Invoices not yet paid, oldest first. */
  unpaidInvoices: { period: string; amountMinor: number; status: string }[];
  monthlyPriceMinor: number;
  /**
   * Trials the hotel has asked to KEEP, from the banner in their own product — product name and the
   * day they asked. Empty for everyone else.
   */
  keepRequests?: { product: string; askedAt: Date; endsAt: Date }[];
  /**
   * Other clients whose staff have signed in from an address this client's staff also used.
   *
   * ⚠️ Signup stores no IP, deliberately — a form that a hotel fills in before it trusts us is the
   * wrong place to start collecting addresses. This comes from `AuthEvent`, which records the IP of
   * a **sign-in**, so it only exists once somebody has an account and has used it.
   *
   * Empty for almost everybody. Never a verdict: see the flag below for why.
   *
   * Populated on the client DETAIL page only, not on the list. Resolving it needs two queries per
   * client and the list renders every one of them — and the list is a scan, while the detail page is
   * what somebody reads before picking up the phone, which is the only moment this changes anything.
   */
  sharedSignInWith?: { ip: string; clients: string[] }[];
  /**
   * Bookings a channel delivered that we could NOT turn into a reservation, and the oldest one.
   *
   * ⚠️ Deliberately counted from the RESERVATIONS, not from the Error Center. A hotel can press
   * "Resolve" on the error — which dismisses the reminder and imports nothing — and that is exactly
   * what happened on 2026-09-15: the error was marked resolved, the booking stayed unimported, and
   * two days later nothing anywhere knew. A signal that a customer can switch off by tidying their
   * screen is not a signal.
   */
  failedImports?: { count: number; oldestAt: Date };
}

const DAY = 86_400_000;
const daysSince = (d: Date, now: Date) => Math.floor((now.getTime() - d.getTime()) / DAY);

/**
 * A client is only "quiet" once they have had time to start. Flagging a hotel onboarded yesterday for
 * having no bookings is noise, and noise is how a console teaches you to ignore it.
 */
const GRACE_DAYS = 14;
/** No booking in this long, from a client that has taken them before, is a churn signal. */
const QUIET_DAYS = 30;
/** A sync that has not run in this long means ARI is drifting from what the OTAs show. */
const STALE_SYNC_HOURS = 48;

export function clientAttention(s: ClientSignals, now: Date = new Date()): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const age = daysSince(s.createdAt, now);

  /*
   * ⚠️ Noticed, never blocked.
   *
   * Signup used to REFUSE a disposable domain. That is the obvious control and the wrong trade: an
   * abusive trial costs us thirty days of software that is nearly free to serve, while a real hotel
   * turned away at the door assumes the product is not for them and never tells us. One of those
   * mistakes is recoverable and the other is invisible.
   *
   * So it is a `note`, not an `act`: something worth knowing before a call, not a reason to do
   * anything. Derived at read time rather than stored, so it cannot age into a stale verdict
   * attached to a customer who has been paying for a year.
   */
  if (s.ownerEmail && isDisposableEmail(s.ownerEmail)) {
    flags.push({
      severity: "note",
      title: "Signed up with a temporary email",
      detail:
        "The owner's address is on a disposable-mail domain. Often nothing — people use them to look around — but worth a real address before they go live, or invoices and password resets will reach nobody.",
    });
  }

  /*
   * ⚠️ The same trade as the temporary-email flag above, and it matters more here because the
   * innocent explanations are the COMMON ones.
   *
   * Two accounts signing in from one address is usually a consultant onboarding hotels, a group
   * setting up its properties as separate clients, an agency, or plain carrier-grade NAT — a whole
   * mobile network can share one address. Every one of those is a customer we want, and several of
   * them are the *best* kind: somebody bringing us more than one hotel.
   *
   * So this never accuses and never blocks. It says what was seen and names the likely reason
   * first, because the cost of being wrong is a founder opening a call by implying the person on
   * the other end is a fraud. It escalates only on volume, where the innocent readings run out.
   *
   * Derived at read time, never stored, so it cannot age into a verdict attached to a client who
   * has been paying for a year.
   */
  const shared = s.sharedSignInWith ?? [];
  if (shared.length > 0) {
    const others = [...new Set(shared.flatMap((x) => x.clients))];
    if (others.length > 0) {
      flags.push({
        severity: others.length >= 3 ? "soon" : "note",
        title: others.length === 1 ? "Shares a sign-in address with 1 other client" : `Shares a sign-in address with ${others.length} other clients`,
        detail:
          `Staff here have signed in from the same address as ${others.slice(0, 3).join(", ")}` +
          `${others.length > 3 ? ` and ${others.length - 3} more` : ""}. ` +
          (others.length >= 3
            ? "Usually a consultant or a group running several hotels — which is worth a conversation either way, because that is a bigger account than one trial."
            : "Most often a consultant, a group, or simply a shared network. Worth knowing before a call, not a reason to do anything."),
      });
    }
  }

  /*
   * ⚠️ The most urgent thing this file can say.
   *
   * A failed import is a booking the OTA has CONFIRMED to a guest and we hold no stay for. Two
   * things follow, and both are worse than any billing question elsewhere in this list: somebody may
   * arrive to a front desk with no reservation, and the room is still on sale, so it can be sold
   * again — the double booking this platform exists to prevent, arriving through the front door.
   *
   * It is `act` from the first one and it never ages into a milder colour, because time does not
   * make an unimported booking safer; it makes the arrival closer.
   */
  const failed = s.failedImports;
  if (failed && failed.count > 0) {
    const days = daysSince(failed.oldestAt, now);
    flags.push({
      severity: "act",
      title: failed.count === 1 ? "A booking never reached the calendar" : `${failed.count} bookings never reached the calendar`,
      detail:
        `The channel confirmed ${failed.count === 1 ? "it" : "them"} to the guest and we could not import ` +
        `${failed.count === 1 ? "it" : "them"} — the room type or rate plan was not mapped. ` +
        `${days === 0 ? "Today" : `Oldest is ${days} day${days === 1 ? "" : "s"} old`}. ` +
        "Nobody is holding the room, and the guest thinks they have one. Finish the mapping and re-sync.",
    });
  }

  if (s.status === "suspended") {
    flags.push({
      severity: "act",
      title: "Suspended",
      detail: "Every product is locked for this client. Their staff cannot sign in.",
    });
    /*
     * Nothing else matters while they are locked out, and listing "no bookings in 30 days" under a
     * suspension is telling someone their car won't start while it is up on the ramp.
     *
     * ⚠️ `return flags` keeps what was pushed ABOVE this block, and three checks sit there on
     * purpose: the temporary email, the shared sign-in address, and — the one that matters — a
     * booking that never reached the calendar. Suspending an account does not un-confirm a booking
     * the OTA already promised a guest, and somebody is still going to arrive. Moving any of those
     * below this line would silence them, which is a decision, not a tidy-up.
     */
    return flags;
  }

  /*
   * --- the customer put their hand up ------------------------------------
   *
   * FIRST, above unpaid invoices, and that ordering is the point: this is the only flag in the file
   * raised by the customer rather than derived from their behaviour, and it is the one with a clock
   * on it. They pressed "Keep it" inside the product; if nobody rings before the trial ends, the
   * software switches itself off underneath a hotel that just said they wanted it — which is the
   * worst possible answer to a customer saying yes.
   *
   * `act` regardless of how many days are left, because the work is one phone call and the cost of
   * being late is losing a sale that was already made.
   */
  for (const k of s.keepRequests ?? []) {
    const daysLeft = Math.max(0, Math.ceil((k.endsAt.getTime() - now.getTime()) / DAY));
    flags.push({
      severity: "act",
      title: `They want to keep ${k.product}`,
      detail: `Asked ${daysSince(k.askedAt, now) === 0 ? "today" : `${daysSince(k.askedAt, now)} days ago`}. The trial still ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — price it with them and mark it kept.`,
    });
  }

  // --- money -------------------------------------------------------------
  if (s.unpaidInvoices.length > 0) {
    const oldest = s.unpaidInvoices[0]!;
    const totalMinor = s.unpaidInvoices.reduce((sum, i) => sum + i.amountMinor, 0);
    flags.push({
      severity: s.unpaidInvoices.length > 1 ? "act" : "soon",
      title: `${s.unpaidInvoices.length} unpaid invoice${s.unpaidInvoices.length === 1 ? "" : "s"}`,
      detail: `€${(totalMinor / 100).toFixed(2)} outstanding, oldest ${oldest.period} (${oldest.status}).`,
    });
  }

  // --- onboarding that stalled -------------------------------------------
  // The most expensive failure in SaaS: they paid, they never set it up, and nobody noticed. It is
  // also the most fixable — one phone call inside the first fortnight.
  if (s.properties === 0) {
    flags.push({
      severity: age > GRACE_DAYS ? "act" : "soon",
      title: "No property yet",
      detail: `Onboarded ${age} day${age === 1 ? "" : "s"} ago and has not created a property — nothing can be sold.`,
    });
  } else if (s.roomTypes === 0) {
    flags.push({
      severity: age > GRACE_DAYS ? "act" : "soon",
      title: "No room types",
      detail: "A property exists but has no rooms, so there is no inventory to sell.",
    });
  }

  // --- paying for something they never turned on --------------------------
  // Each of these is a refund request forming. Catching it early turns it into an onboarding call.
  if (s.entitlements.pms && s.units === 0 && age > GRACE_DAYS) {
    flags.push({
      severity: "soon",
      title: "RevioPMS unused",
      detail: "Billed for RevioPMS but no physical rooms exist — housekeeping and front desk cannot run.",
    });
  }
  if (s.entitlements.channelManager && s.channelsConnected === 0 && age > GRACE_DAYS) {
    flags.push({
      severity: "soon",
      title: "No channel connected",
      detail:
        s.channels === 0
          ? "Billed for RevioLink with no channels set up at all."
          : `${s.channels} channel(s) configured, none connected — nothing is being pushed.`,
    });
  }

  // --- the loop actually breaking ----------------------------------------
  if (s.openErrors > 0) {
    flags.push({
      severity: s.openErrors >= 5 ? "act" : "soon",
      title: `${s.openErrors} open sync error${s.openErrors === 1 ? "" : "s"}`,
      detail: "Rates or availability may not have reached the channels. Risk of overselling.",
    });
  }
  if (s.channelsConnected > 0 && s.lastSyncAt) {
    const hours = Math.floor((now.getTime() - s.lastSyncAt.getTime()) / 3_600_000);
    if (hours >= STALE_SYNC_HOURS) {
      flags.push({
        severity: "act",
        title: `No sync for ${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""}`,
        detail: "Connected channels but nothing pushed recently — the OTAs are showing stale ARI.",
      });
    }
  }

  // --- drifting toward churn ---------------------------------------------
  if (s.lastReservationAt && daysSince(s.lastReservationAt, now) >= QUIET_DAYS) {
    flags.push({
      severity: "soon",
      title: `Quiet for ${daysSince(s.lastReservationAt, now)} days`,
      detail: "No reservation from any source. Either their season ended or they have stopped using it.",
    });
  }

  // --- opportunity, not a fault ------------------------------------------
  // Deliberately `note`: nothing is broken, but it is the cheapest expansion conversation available,
  // and it is invisible unless someone derives it.
  if (s.bookingEngineProperties > 0 && s.directReservationsLast30d === 0 && age > GRACE_DAYS) {
    flags.push({
      severity: "note",
      title: "Booking engine live but unused",
      detail: "RevioDirect is switched on and has taken no bookings in 30 days — is the link on their site?",
    });
  }
  if (!s.entitlements.reservation && !s.entitlements.pms && s.reservationsLast30d > 0 && age > GRACE_DAYS) {
    flags.push({
      severity: "note",
      title: "Expansion candidate",
      detail: `Active on RevioLink only, ${s.reservationsLast30d} booking(s) in 30 days — a candidate for RevioCRS.`,
    });
  }

  return flags;
}

const RANK: Record<Severity, number> = { act: 0, soon: 1, note: 2 };

/** Most urgent first; ties keep the order the rules produced, which reads deliberately. */
export function sortBySeverity(flags: AttentionFlag[]): AttentionFlag[] {
  return [...flags].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** The single worst thing about this client, for a list row. `null` when all is well. */
export function worstSeverity(flags: AttentionFlag[]): Severity | null {
  if (flags.length === 0) return null;
  return sortBySeverity(flags)[0]!.severity;
}
