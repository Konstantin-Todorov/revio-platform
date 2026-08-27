import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { mergeGuest } from "@/lib/actions-reservations";
import type { DuplicateCandidate } from "@revio/core";

/**
 * Possible duplicates of this guest — F2.
 *
 * ## Why a human presses the button
 *
 * The matching is good enough to *suggest* and nowhere near good enough to *decide*. A wrong merge
 * folds two people's stay histories into one and there is no clean way back — so this offers, states
 * why it thinks so, and links to the other record so someone can look before they act.
 *
 * ## Why the reason is shown per row
 *
 * "Same email" and "same name" are not the same claim. Two guests called Maria Petrova at a Bulgarian
 * hotel is an ordinary Tuesday; two guests with the same real email address is almost certainly one
 * person. Hiding that distinction behind the word "duplicate" invites a careless merge on the weakest
 * signal, which is exactly the one that should be checked hardest.
 */

const REASON_LABEL: Record<DuplicateCandidate["reason"], { text: string; strong: boolean }> = {
  email: { text: "Same email address", strong: true },
  phone: { text: "Same phone number", strong: true },
  name: { text: "Same name — check before merging", strong: false },
};

export function DuplicateGuests({
  guestId,
  guestName,
  candidates,
}: {
  guestId: string;
  guestName: string;
  candidates: DuplicateCandidate[];
}) {
  if (candidates.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Possible duplicates"
        subtitle={`${candidates.length} other record${candidates.length === 1 ? "" : "s"} may be the same person`}
      />
      <ul className="divide-y divide-surface-border">
        {candidates.map((c) => {
          const reason = REASON_LABEL[c.reason];
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Users className="h-4 w-4 shrink-0 text-ink-300" />
              <div className="min-w-0 flex-1">
                <Link href={`/guests/${c.id}`} className="text-[13.5px] font-semibold text-ink-900 hover:underline">
                  {c.name}
                </Link>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                <p className={`mt-0.5 text-[11.5px] ${reason.strong ? "text-ink-400" : "text-warning-600"}`}>
                  {reason.text}
                </p>
              </div>
              {/*
                The direction is fixed and stated: the OTHER record is folded into THIS one, because
                this is the page the person is looking at and reading the sentence backwards is how a
                merge goes the wrong way. To merge the other direction, open the other guest.
              */}
              <form action={mergeGuest} className="shrink-0">
                <input type="hidden" name="winnerId" value={guestId} />
                <input type="hidden" name="loserId" value={c.id} />
                <button
                  type="submit"
                  className="rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
                >
                  Merge into {guestName.split(" ")[0]}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-surface-border px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-400">
        Merging moves the other record&rsquo;s bookings and notes here and fills in any contact detail
        this profile is missing. Nothing already on this profile is overwritten, and the other record
        is kept — it stops appearing in lists but its history is not lost.
      </p>
    </Card>
  );
}
