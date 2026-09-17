/**
 * Whether a client may be removed, and what to do instead when it may not.
 *
 * ## Why this is a decision and not a button
 *
 * Deleting a hotel deletes its reservations, its guests, its folios and its rooms. There are two
 * completely different reasons somebody reaches for it, and only one of them is legitimate:
 *
 * - **This account should never have existed** — a demo tenant, a smoke test, a signup that was
 *   abandoned before anyone confirmed it. Nothing here is a record of anything real.
 * - **This client left.** That is NOT a deletion. They may come back, their data is theirs, and
 *   their invoices are ours to keep. Suspend it; the row stays, the login stops.
 *
 * The founder's rule, and it is the right one: *"don't delete it because they can come back at any
 * time."* So this refuses anything that looks like a real trading relationship and says which of the
 * two doors to use.
 *
 * ## ⚠️ An invoice that left the building can never be deleted
 *
 * A `draft` invoice is a number we have not shown anyone; it can go. A `sent` or `paid` one is a tax
 * document that exists in somebody else's accounts too, and in their auditor's. Deleting our copy
 * does not delete theirs — it just means we cannot answer a question about it. There is no override
 * for this, deliberately: an override on a rule about accounting records is a rule that will be
 * overridden.
 */

export interface ClientDeletionFacts {
  /** Invoices we have actually issued — `sent` or `paid`. Drafts are not counted. */
  issuedInvoices: number;
  /** Reservations of any status. Evidence the hotel really traded. */
  reservations: number;
  /** A permanently-ours demo tenant. */
  isDemo: boolean;
  /** Never confirmed an email — nothing about it is real yet. */
  isPendingSignup: boolean;
  /** Currently switched off rather than trading. */
  isSuspended: boolean;
  /**
   * Channels still switched ON at the channel manager's own end.
   *
   * ⚠️ Not the same question as our `Channel.status`. Ours says what we are doing; this says what
   * THEY still have — and Channex bills per property with an active channel.
   */
  liveRemoteChannels: number;
}

export type ClientDeletionVerdict =
  | { ok: true; severity: "harmless" | "destructive"; warning?: string }
  | { ok: false; reason: string; instead: string };

export function canDeleteClient(f: ClientDeletionFacts): ClientDeletionVerdict {
  /*
   * ⚠️ FIRST, and a refusal rather than a warning.
   *
   * Deleting a client removed every record that its property existed — while the channel stayed
   * switched on at Channex, still connected to the OTA and still billed to us, every month, with
   * nothing left in the product to attribute the charge to or even to name the hotel. That is not a
   * risk to be accepted with a warning; it is a bill arriving forever for something nobody can find.
   *
   * It is also trivially avoidable: disconnecting the channel switches the far end off, and then
   * this rule stops applying. So the refusal names the one step, and it comes before every other
   * check because it is the only one that leaves something running after the row is gone.
   */
  if (f.liveRemoteChannels > 0) {
    const n = f.liveRemoteChannels;
    return {
      ok: false,
      reason:
        `${n} of this client's channel${n === 1 ? " is" : "s are"} still switched on at the channel manager. ` +
        `Deleting the client here would not switch ${n === 1 ? "it" : "them"} off: the connection would stay live with the OTA, ` +
        "we would go on being billed for the property, and there would be nothing left in here to say whose it was.",
      instead: `Disconnect ${n === 1 ? "that channel" : "those channels"} on this page first — that closes the rooms and switches the far end off — then delete.`,
    };
  }

  if (f.issuedInvoices > 0) {
    return {
      ok: false,
      reason:
        `This client has ${f.issuedInvoices} invoice${f.issuedInvoices === 1 ? "" : "s"} that ${f.issuedInvoices === 1 ? "has" : "have"} been sent or paid. ` +
        "An issued invoice is a tax document that exists in their accounts too — deleting our copy only means we cannot answer questions about it.",
      instead: "Suspend the account instead. Their login stops, every record stays, and one click brings them back.",
    };
  }

  /*
   * A signup nobody ever confirmed: no entitlement was granted, no trial clock started, nothing was
   * ever shown to a human. Removing it is tidying, not deletion.
   */
  if (f.isPendingSignup) {
    return { ok: true, severity: "harmless" };
  }

  if (f.isDemo) {
    return {
      ok: true,
      severity: "destructive",
      warning:
        "This is a demo tenant. Demo hotels are deliberately kept in production so every rehearsal " +
        "runs against the real migrations and the real RLS — deleting one removes a thing we use.",
    };
  }

  if (f.reservations > 0) {
    return {
      ok: true,
      severity: "destructive",
      warning:
        `This hotel has ${f.reservations} reservation${f.reservations === 1 ? "" : "s"}. Those are real stays by real guests, ` +
        "and they go with it. If this client has simply stopped paying, suspend them instead — they can come back at any time.",
    };
  }

  if (!f.isSuspended) {
    return {
      ok: true,
      severity: "destructive",
      warning: "This account is still active. If the client has left rather than never existed, suspending keeps their data for their return.",
    };
  }

  return { ok: true, severity: "destructive" };
}

/**
 * ⚠️ The tenant-scoped tables that a `DELETE FROM "Tenant"` does NOT reach.
 *
 * 55 tables are removed by the cascade. These six carry `tenantId` as a plain column with no
 * foreign key — the RLS pattern needs the column, not the constraint — so a delete leaves them
 * behind as rows belonging to a hotel that no longer exists.
 *
 * Two of them make this more than untidiness: `ConnectivityCredential` holds ENCRYPTED OTA
 * CREDENTIALS, which would sit in the database forever after the customer left, and `Invoice` is an
 * accounting record. Both are exactly what a deletion request is supposed to remove.
 *
 * `client-deletion.db.test.ts` asks the live schema which tables the cascade misses and fails if
 * that set stops matching this list — so a new tenant-scoped table added next month breaks the
 * build rather than quietly leaking rows.
 */
export const TENANT_TABLES_WITHOUT_CASCADE = [
  "AuthEvent",
  "ConnectivityCredential",
  "Invoice",
  "PermissionRole",
  "RoleAccess",
  "SupportRequest",
] as const;
