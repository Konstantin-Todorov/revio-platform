/**
 * What an invoice may do next — and what it may never do again.
 *
 * ## Why this is not a display concern
 *
 * `setInvoiceStatus` accepted **any status from any status** with no checks and no attribution. A
 * draft could be marked paid without ever being issued; a paid invoice could be dragged back to
 * draft; and nothing recorded who had done either.
 *
 * That produced a real row in production: `Hotel Sofia · 2026-07` — **paid, with no invoice number
 * and no `issuedAt`.** A document that was settled without ever having been issued.
 *
 * Revio is the legal issuer, VAT-registered, with its own gapless number series. So these are not
 * internal records and the state machine is not a nicety:
 *
 *  - **An issued document is immutable.** Corrections happen by credit note, never by editing.
 *  - **Only an issued document can be paid.** Money cannot be received against a thing that does
 *    not exist.
 *  - **Nothing returns to draft.** Draft is the state before a number is drawn; once a number is
 *    drawn the document exists whatever anybody thinks of it.
 *
 * Pure, so both the action and the screen ask the same question and cannot disagree about the answer.
 */

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceStateFacts {
  status: string;
  /**
   * A drawn number from the series. **Its presence is what "issued" means** — the number is what
   * makes the document exist, so it is the only field these rules key on.
   */
  number: string | null;
  /** Informational. Optional because `number` is the authority and a caller may not have selected it. */
  issuedAt?: Date | null;
}

export interface TransitionVerdict {
  ok: boolean;
  /** Shown to the operator. Says what is wrong AND what to do instead. */
  reason?: string;
}

/** Has this document been issued — i.e. has it drawn a number from the series? */
export function isIssued(inv: InvoiceStateFacts): boolean {
  return inv.number != null && inv.number.trim() !== "";
}

/**
 * May this invoice move to `next`?
 *
 * The rules read in the order somebody argues with them, so the message names the specific
 * objection rather than a generic refusal.
 */
export function canTransition(inv: InvoiceStateFacts, next: InvoiceStatus): TransitionVerdict {
  const from = inv.status;
  if (from === next) return { ok: false, reason: `This invoice is already ${next}.` };

  if (from === "void") {
    return { ok: false, reason: "This invoice is void. A void document cannot be revived — issue a new one." };
  }

  // Nothing goes back to draft. Draft is the state BEFORE a number exists.
  if (next === "draft") {
    return {
      ok: false,
      reason: isIssued(inv)
        ? `Invoice ${inv.number} has been issued and cannot return to draft. Issue a credit note instead.`
        : "An invoice cannot be moved back to draft.",
    };
  }

  if (next === "sent") {
    if (!isIssued(inv)) {
      return { ok: false, reason: "Issue the invoice first — sending needs a number from the series." };
    }
    if (from === "paid") {
      return { ok: false, reason: "This invoice is already paid. Marking it sent again would lose the payment record." };
    }
    return { ok: true };
  }

  if (next === "paid") {
    if (!isIssued(inv)) {
      /*
       * The exact production defect. An unissued document has no number, no date and no legal
       * existence, so there is nothing for a payment to be against — and the paid row that resulted
       * could not be reconciled to anything.
       */
      return {
        ok: false,
        reason: "This invoice has not been issued yet, so it cannot be paid. Issue it first — a payment has to be against a numbered document.",
      };
    }
    return { ok: true };
  }

  if (next === "void") {
    if (!isIssued(inv)) {
      return { ok: false, reason: "An unissued draft does not need voiding — delete it." };
    }
    if (from === "paid") {
      return { ok: false, reason: "A paid invoice cannot be voided. Issue a credit note instead." };
    }
    return { ok: true };
  }

  return { ok: false, reason: "Unknown status." };
}

/** The transitions to offer as buttons. Anything absent is not merely hidden — it is refused. */
export function allowedTransitions(inv: InvoiceStateFacts): InvoiceStatus[] {
  return (["sent", "paid", "void"] as InvoiceStatus[]).filter((s) => canTransition(inv, s).ok);
}

/**
 * Is the amount on this row NET or GROSS?
 *
 * The founder read four invoices as "three different pricing conventions". They were not: a **draft
 * carries the net price** and VAT is computed at issue, so the same column was showing net for some
 * rows and gross for others with nothing saying which. Two facts in one column is how a finance
 * screen loses trust.
 */
export function amountBasis(inv: { grossMinor: number | null; number: string | null }): "gross" | "net" {
  return inv.grossMinor != null && isIssued({ ...inv, status: "" }) ? "gross" : "net";
}
