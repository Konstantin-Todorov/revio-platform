import { RETENTION_DAYS, retentionEndsAt, type AccountType } from "./client-lifecycle.js";

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
 * ## ⚠️ An invoice that left the building is never deleted
 *
 * A `draft` invoice is a number we have not shown anyone; it can go. A `sent` or `paid` one on our
 * tax series exists in somebody else's accounts too, and in their auditor's. Deleting the CLIENT
 * does not delete those: they stay, archived with the buyer's details they were issued with, and
 * no override exists for that.
 */

export interface ClientDeletionFacts {
  accountType: AccountType;
  /** `Tenant.status`. */
  status: string;
  /** When it was closed, for the retention window. Null unless `status` is `closed`. */
  closedAt: Date | null;
  now: Date;
  /**
   * Tax invoices — sent or paid, on OUR ten-digit series. These are KEPT when a client is deleted
   * (archived with the buyer's details they were issued with), so they never block a deletion.
   * `DEMO-` invoices are rehearsals and go with the account.
   */
  taxInvoices: number;
  /** Reservations of any status. Evidence the hotel really traded. */
  reservations: number;
  /**
   * Channels still switched ON at the channel manager's own end.
   *
   * ⚠️ Not the same question as our `Channel.status`. Ours says what we are doing; this says what
   * THEY still have — and Channex bills per property with an active channel.
   */
  liveRemoteChannels: number;
}

export type ClientDeletionVerdict =
  | { ok: true; severity: "harmless" | "destructive"; warning?: string; keepsInvoices?: number }
  | { ok: false; reason: string; instead: string };

/**
 * ## The rule, by kind of account (2026-09-28)
 *
 * The first version refused any client with a sent or paid invoice, with no way forward — so demo
 * hotels whose rehearsal invoices had been "paid" could never be removed, and nothing told anybody
 * what to do next. The question it was really asking is *is this a record of something real?*, and
 * the account type answers that directly:
 *
 * - **Demo and test** are ours. They go whenever we like, their `DEMO-` invoices with them.
 * - **An unconfirmed signup, or a real account that never traded** (no bookings, no tax invoice) is
 *   a row that should not exist; it may go.
 * - **A real client that traded** is closed first and kept for `RETENTION_DAYS` — they can come back,
 *   and the founder's rule is that a client who left is not a deletion. After that it may go, and its
 *   tax invoices stay in the archive, because those are ours to keep whatever happens to the account.
 */
export function canDeleteClient(f: ClientDeletionFacts): ClientDeletionVerdict {
  /*
   * ⚠️ FIRST, and a refusal rather than a warning.
   *
   * Deleting a client removed every record that its property existed — while the channel stayed
   * switched on at Channex, still connected to the OTA and still billed to us, every month, with
   * nothing left in the product to attribute the charge to or even to name the hotel. That is not a
   * risk to be accepted with a warning; it is a bill arriving forever for something nobody can find.
   */
  if (f.liveRemoteChannels > 0) {
    const n = f.liveRemoteChannels;
    return {
      ok: false,
      reason:
        `${n} of this client's channel${n === 1 ? " is" : "s are"} still switched on at the channel manager. ` +
        `Deleting the client here would not switch ${n === 1 ? "it" : "them"} off: the connection would stay live with the OTA, ` +
        "we would go on being billed for the property, and there would be nothing left in here to say whose it was.",
      instead: `Disconnect ${n === 1 ? "that channel" : "those channels"} on the Channels tab first — that closes the rooms and switches the far end off — then delete.`,
    };
  }

  const keeps = f.taxInvoices > 0 ? { keepsInvoices: f.taxInvoices } : {};

  if (f.status === "pending_signup") return { ok: true, severity: "harmless", ...keeps };

  if (f.accountType === "test") return { ok: true, severity: "harmless", ...keeps };

  if (f.accountType === "demo") {
    return {
      ok: true,
      severity: "destructive",
      warning: "This is a sales demo. Its sample stays are refreshed every night so it always looks lived-in — make sure nobody is about to use it in a demo.",
      ...keeps,
    };
  }

  // Live or pilot, and it never traded: a row that should not exist.
  if (f.reservations === 0 && f.taxInvoices === 0) {
    return { ok: true, severity: "destructive", warning: "No bookings and no invoices — nothing here is a record of anything real yet." };
  }

  if (f.status !== "closed" || !f.closedAt) {
    return {
      ok: false,
      reason: `This client has traded here (${f.reservations} reservation${f.reservations === 1 ? "" : "s"}). A client who leaves can come back, so their data is not deleted straight away.`,
      instead: `Close the client instead. Sign-in stops, the data is kept for ${RETENTION_DAYS} days and can be reopened in one click; after that it can be deleted.`,
    };
  }

  const until = retentionEndsAt(f.closedAt);
  if (f.now.getTime() < until.getTime()) {
    return {
      ok: false,
      reason: `Closed on ${f.closedAt.toISOString().slice(0, 10)}. Their data is kept for ${RETENTION_DAYS} days in case they come back.`,
      instead: `It can be deleted from ${until.toISOString().slice(0, 10)}. Until then it can be reopened in one click.`,
    };
  }

  return {
    ok: true,
    severity: "destructive",
    warning: `${f.reservations} reservation${f.reservations === 1 ? "" : "s"} and every guest record go with it.`,
    ...keeps,
  };
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
/**
 * Tables a client deletion empties FIRST, before the tenant row — because the cascade would trip on
 * them otherwise.
 *
 * `ReservationLine.roomTypeId` and `.ratePlanId` are `ON DELETE RESTRICT`: a room type that has been
 * sold cannot be deleted from under its bookings. Postgres checks RESTRICT the moment the room type
 * goes, even when the same cascade would have removed the lines a step later — so deleting a tenant
 * that had ever taken a booking failed, and showed the operator a crash screen (2026-09-26, on a
 * real client). Deleting the reservations first takes their lines with them (that FK cascades), and
 * the room types and plans are then free to go.
 *
 * `client-deletion.db.test.ts` recomputes, from the live constraint graph, every RESTRICT foreign key
 * inside the tenant's cascade and fails if one is not cleared by this list.
 */
export const TENANT_TABLES_DELETED_FIRST = ["Reservation"] as const;

export const TENANT_TABLES_WITHOUT_CASCADE = [
  "AuthEvent",
  "ConnectivityCredential",
  "Invoice",
  "PermissionRole",
  "RoleAccess",
  "SupportRequest",
] as const;
