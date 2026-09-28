import { Card, CardHeader } from "@/components/ui/primitives";

/**
 * Every change we made to this account — status, type, billing, products — with who, when, from
 * what, to what, and why.
 *
 * Separate from the relationship log below it on purpose: that is what was SAID (calls, notes);
 * this is what was DONE to the account. Mixing them buries a suspension between two phone calls.
 * Started 2026-09-28; changes made before then were never recorded anywhere, and the empty state
 * says so rather than implying nothing happened.
 */
const KIND: Record<string, string> = {
  created: "Created", status: "Status", type: "Account type", billing: "Billing", product: "Products",
};
const STATUS_WORD: Record<string, string> = {
  active: "Active", suspended: "Suspended", closed: "Closed", pending_signup: "Awaiting confirmation",
};
const word = (v: string | null) => (v ? STATUS_WORD[v] ?? v : null);
// Our office's clock — the team reading this is in Sofia, and "08:17 UTC" is 11:17 to them.
const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ClientHistory({
  events,
}: {
  events: { id: string; at: string; kind: string; fromValue: string | null; toValue: string | null; reason: string | null; actorName: string }[];
}) {
  return (
    <Card>
      <CardHeader title={`Changes to the account (${events.length})`} />
      {events.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-ink-500">
          No changes recorded. The record starts on 28 September 2026 — anything done to this account before then was not written down.
        </p>
      ) : (
        <ol className="divide-y divide-surface-border">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-[13px] sm:grid-cols-[9.5rem_1fr]">
              <time dateTime={e.at} className="tnum text-[12px] text-ink-400">
                {when.format(new Date(e.at))}
              </time>
              <div>
                <div className="text-ink-900">
                  <span className="font-semibold">{KIND[e.kind] ?? e.kind}</span>
                  {e.fromValue && <> · {e.kind === "status" ? word(e.fromValue) : e.fromValue} →</>}
                  {e.toValue && <> <span className="font-semibold">{e.kind === "status" ? word(e.toValue) : e.toValue}</span></>}
                </div>
                <div className="text-[12px] text-ink-500">
                  {e.reason ? <>“{e.reason}” — </> : null}
                  {e.actorName}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
