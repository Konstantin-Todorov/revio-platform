"use client";

import { useActionState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import { issueInvoiceAction, type ActionResult } from "@/lib/actions-company";

/**
 * Issue a draft — the moment a billing row becomes a document.
 *
 * The error path is the reason this is a client component rather than a plain form. Every refusal
 * `issueInvoice` returns is actionable ("no billing details for this client", "the price list has
 * changed since this draft"), and each one names what to do. Swallowing them into a silent no-op
 * would leave an operator clicking a button that appears to do nothing while an invoice is due.
 */
export function IssueInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(issueInvoiceAction, null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <form action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded border border-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck2 className="h-3 w-3" />}
          {pending ? "Issuing…" : "Issue"}
        </button>
      </form>
      {state?.error && (
        // Wide, wrapping and left-aligned: these messages are sentences, and truncating one into a
        // table cell would hide the half that says how to fix it.
        <span role="alert" className="max-w-[280px] rounded bg-danger-50 px-1.5 py-1 text-[10.5px] font-medium leading-snug text-danger-600">
          {state.error}
        </span>
      )}
    </span>
  );
}
