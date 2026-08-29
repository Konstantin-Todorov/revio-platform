import { Inbox, Check, Undo2, Mail } from "lucide-react";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { listLeads } from "@/lib/data";
import { setLeadHandled } from "@/lib/actions-leads";

export const dynamic = "force-dynamic";

/**
 * Website demo requests.
 *
 * This screen exists because the founder could not find their own leads. Every notification email
 * had been delivered — Resend confirmed all of them — and that turned out to be the problem rather
 * than the defence: a mail client is a notification channel, and a lead read on a phone and not
 * acted on immediately leaves no trace anywhere in the product.
 *
 * Unhandled first, and the whole enquiry on one row: what a call would need is the rooms, the
 * products, what they use today and the price they were shown, and going to a detail page for each
 * of those is how a queue of six becomes a queue nobody works.
 */
export default async function LeadsPage() {
  const { rows, openCount } = await listLeads();

  return (
    <div>
      <PageHeader
        title="Demo requests"
        subtitle="Enquiries from the website — stored here as well as emailed, so one is never only an email"
      />

      <Card>
        <CardHeader
          title={openCount > 0 ? `${openCount} waiting for a reply` : "Nothing waiting"}
          action={
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-400">
              <Inbox className="h-3.5 w-3.5" />
              {rows.length} in total
            </span>
          }
        />

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-ink-400">
            No demo requests yet. They arrive here the moment someone submits the form on the website.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {rows.map((l) => {
              const facts = [
                l.company,
                l.rooms ? `${l.rooms} rooms` : null,
                l.interestedIn,
                l.currentSystem ? `now on ${l.currentSystem}` : null,
                l.quote ? `quoted ${l.quote}` : null,
              ].filter(Boolean);

              return (
                <li key={l.id} className={`px-4 py-3.5 ${l.handledAt ? "opacity-55" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink-900">{l.name}</span>
                        <a
                          href={`mailto:${l.email}`}
                          className="inline-flex items-center gap-1 text-[12.5px] text-brand-700 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {l.email}
                        </a>
                        {l.handledAt && <StatusPill tone="success">Replied</StatusPill>}
                      </div>

                      {facts.length > 0 && (
                        <p className="mt-1 text-[12.5px] text-ink-600">{facts.join(" · ")}</p>
                      )}
                      {l.message && (
                        <p className="mt-1.5 rounded-md bg-surface-muted px-2.5 py-1.5 text-[12.5px] italic leading-relaxed text-ink-700">
                          “{l.message}”
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-ink-400">
                        {l.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        {l.page ? ` · from ${l.page}` : ""}
                        {l.source ? ` · ${l.source}` : ""}
                      </p>
                    </div>

                    <form action={setLeadHandled} className="shrink-0">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="handled" value={l.handledAt ? "0" : "1"} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
                      >
                        {l.handledAt ? (
                          <>
                            <Undo2 className="h-3.5 w-3.5" /> Reopen
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" /> Mark replied
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
