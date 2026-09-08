import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";

/**
 * Email that arrived at the support mailbox and could not be filed.
 *
 * Replies we *did* file need no list — they are in their own threads, which is the point. What needs
 * saying out loud is the mail we decided not to act on, because the alternative is the one question
 * this feature must be able to answer: *"they swear they replied."* Without this the honest response
 * would be a shrug; with it there is a row saying what arrived and why nothing happened.
 *
 * None of this is a failure. An out-of-office is correctly ignored, and mail from an address no
 * Revio account uses is correctly left alone — it is still sitting in the mailbox for a person, and
 * the job never marks anything read.
 */

const WHY: Record<string, string> = {
  "ignored-automated": "an out-of-office or a bounce — answering it would start a loop",
  "ignored-empty": "nothing but the quoted conversation under the reply",
  "ignored-unknown-sender": "no Revio account uses that address",
  error: "we could not file it — worth a look",
};

export function InboundEmailCard({
  emails,
}: {
  emails: {
    id: string;
    fromEmail: string;
    subject: string;
    outcome: string;
    detail: string | null;
    createdAt: Date;
  }[];
}) {
  if (emails.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title={`Email we did not file · ${emails.length}`}
        subtitle="Still in the mailbox — nothing is ever marked read or deleted by us"
      />
      <ul className="divide-y divide-surface-border">
        {emails.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-[12.5px]">
            <span className="font-semibold text-ink-900">{e.fromEmail}</span>
            <span className="truncate text-ink-600">{e.subject || "(no subject)"}</span>
            <StatusPill tone={e.outcome === "error" ? "danger" : "neutral"}>
              {e.outcome.replace("ignored-", "")}
            </StatusPill>
            <span className="ml-auto text-[11.5px] text-ink-400">
              {e.detail ?? WHY[e.outcome] ?? ""} · {e.createdAt.toISOString().slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
