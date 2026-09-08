import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { addSupportMessage, forSystem, recordSupportRequest } from "@revio/db";
import { bareAddress, decideInbound, referenceSuffix } from "@revio/core";

const prisma = forSystem();

/**
 * Read the support mailbox and file what is in it.
 *
 * ## Why polling, and why this mailbox
 *
 * `reviosoft.app` delivers to an ordinary mailbox — there is no webhook to receive. So the cron that
 * already runs eight jobs runs a ninth, connects over IMAP, and reads what arrived. If the mail
 * hosting ever moves somewhere with webhooks, everything below `fetchMail` stays and only the
 * transport changes.
 *
 * ## It never modifies the mailbox
 *
 * Nothing is marked seen, moved, flagged or deleted. A support inbox is also a human's inbox, and a
 * job that silently marks a customer's email as read is a job that hides it from the person who
 * would otherwise have answered. `InboundEmail.messageId` is how a re-read stays harmless — every
 * message we have already dealt with has a row, and rows are cheap.
 *
 * ## An email is untrusted input
 *
 * Anybody can send one claiming to be anybody. So a message is only filed against a ticket when the
 * **sender's address belongs to a user on that ticket's own tenant**, or is the address the request
 * was raised with. Everything else is recorded and left alone — an unknown sender's mail stays a
 * human's problem in a human's inbox, which is exactly what it is.
 */

export interface InboxResult {
  ok: true;
  configured: boolean;
  read: number;
  filed: number;
  opened: number;
  ignored: number;
}

interface RawMail {
  messageId: string;
  from: string;
  subject: string;
  text: string;
  headers: Record<string, string | undefined>;
  receivedAt: Date | null;
}

/** Everything the mailbox needs, and nothing this code should ever contain. */
function config() {
  const host = process.env.SUPPORT_IMAP_HOST?.trim();
  const user = process.env.SUPPORT_IMAP_USER?.trim();
  const pass = process.env.SUPPORT_IMAP_PASSWORD;
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(process.env.SUPPORT_IMAP_PORT ?? 993),
    secure: process.env.SUPPORT_IMAP_INSECURE !== "1",
    auth: { user, pass },
    // A mailbox that never answers must not hold the whole cron open behind it.
    socketTimeout: 20_000,
    logger: false as const,
  };
}

/**
 * The last 14 days of mail, whatever its read state.
 *
 * Bounded by date rather than by "unseen" precisely because we do not own the read flags — a human
 * reading their inbox must not decide what this job can see. Fourteen days is long enough to survive
 * a broken weekend and short enough that the fetch stays small.
 */
async function fetchMail(): Promise<RawMail[]> {
  const cfg = config();
  if (!cfg) return [];

  const client = new ImapFlow(cfg);
  const out: RawMail[] = [];
  await client.connect();
  try {
    // Read-only: no flags change, nothing is marked seen. The whole design depends on this `true`.
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const since = new Date(Date.now() - 14 * 86_400_000);
      for await (const msg of client.fetch({ since }, { source: true, envelope: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const headers: Record<string, string | undefined> = {};
        parsed.headers.forEach((v, k) => {
          headers[k] = typeof v === "string" ? v : undefined;
        });
        out.push({
          messageId: parsed.messageId ?? `no-id:${msg.uid}`,
          from: parsed.from?.text ?? "",
          subject: parsed.subject ?? "",
          text: parsed.text ?? "",
          headers,
          receivedAt: parsed.date ?? null,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

async function record(
  mail: RawMail,
  outcome: string,
  extra: { requestId?: string; detail?: string } = {},
): Promise<void> {
  await prisma.inboundEmail.create({
    data: {
      messageId: mail.messageId,
      fromEmail: bareAddress(mail.from),
      subject: mail.subject.slice(0, 500),
      outcome,
      requestId: extra.requestId ?? null,
      detail: extra.detail ?? null,
      receivedAt: mail.receivedAt,
    },
  });
}

export async function sweepSupportInbox(): Promise<InboxResult> {
  if (!config()) return { ok: true, configured: false, read: 0, filed: 0, opened: 0, ignored: 0 };

  const mail = await fetchMail();
  const known = new Set(
    (
      await prisma.inboundEmail.findMany({
        where: { messageId: { in: mail.map((m) => m.messageId) } },
        select: { messageId: true },
      })
    ).map((r) => r.messageId),
  );

  let filed = 0;
  let opened = 0;
  let ignored = 0;

  for (const m of mail) {
    if (known.has(m.messageId)) continue;

    const decision = decideInbound({ subject: m.subject, text: m.text, headers: m.headers });
    if (decision.action === "ignore") {
      await record(m, `ignored-${decision.reason}`);
      ignored++;
      continue;
    }

    // Who is this? An address we do not know is not a customer, and their mail stays a human's.
    const from = bareAddress(m.from);
    const sender = await prisma.user.findFirst({
      where: { email: { equals: from, mode: "insensitive" } },
      select: { id: true, name: true, tenantId: true },
    });
    if (!sender) {
      await record(m, "ignored-unknown-sender", { detail: "No Revio account uses this address." });
      ignored++;
      continue;
    }

    if (decision.action === "reply") {
      const suffix = referenceSuffix(decision.reference);
      const request = await prisma.supportRequest.findFirst({
        where: { id: { endsWith: suffix }, tenantId: sender.tenantId },
        select: { id: true },
      });
      if (!request) {
        // The reference did not resolve for THIS sender's hotel — either a typo, or somebody
        // quoting another hotel's reference. Recorded rather than guessed at.
        await record(m, "ignored-unknown-sender", {
          detail: `${decision.reference} is not a request on ${sender.tenantId}.`,
        });
        ignored++;
        continue;
      }

      const added = await addSupportMessage({
        requestId: request.id,
        side: "hotel",
        authorName: sender.name,
        body: decision.body,
      });
      if (!added.ok) {
        await record(m, "error", { requestId: request.id, detail: added.error });
        ignored++;
        continue;
      }

      // A reply reopens it, exactly as one sent from inside the product does.
      await prisma.supportRequest.updateMany({
        where: { id: request.id, handledAt: { not: null } },
        data: { handledAt: null, handledById: null },
      });
      await record(m, "filed", { requestId: request.id });
      filed++;
      continue;
    }

    // No reference: a customer emailed us rather than using the form. That is a request, and
    // `source: "email"` is already what the queue calls one that did not arrive by typing.
    const created = await recordSupportRequest({
      tenantId: sender.tenantId,
      userId: sender.id,
      product: "crs",
      kind: "problem",
      message: decision.body,
      contactName: sender.name,
      contactEmail: from,
      source: "email",
    });
    if (!created.ok) {
      await record(m, "error", { detail: created.error });
      ignored++;
      continue;
    }
    await record(m, "opened", { requestId: created.id });
    opened++;
  }

  return { ok: true, configured: true, read: mail.length, filed, opened, ignored };
}
