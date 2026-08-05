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

  if (s.status === "suspended") {
    flags.push({
      severity: "act",
      title: "Suspended",
      detail: "Every product is locked for this client. Their staff cannot sign in.",
    });
    // Nothing else matters while they are locked out, and listing "no bookings in 30 days" under a
    // suspension is telling someone their car won't start while it is up on the ramp.
    return flags;
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
