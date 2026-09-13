import "server-only";
import { forSystem, withSystemTransaction } from "@revio/db";
import { sendEmail } from "@revio/email";
import {
  PRODUCT_BY_KEY,
  daysRemaining,
  dueReminder,
  needsExpiring,
  renderSystemEmail,
  renderSystemEmailText,
  type ProductKey,
} from "@revio/core";
import { originFor } from "./product-origins";

/**
 * The job that makes a trial a real thing rather than a date somebody wrote down.
 *
 * Warns at seven days and again at one, then stops access when the clock runs out. All three are
 * automatic, because a trial that only ends when somebody remembers is a free product.
 *
 * ## Every step is idempotent
 *
 * Reminders are recorded per threshold and a sent one is never sent again; expiry only touches a
 * trial with no `endedAt`. Running the sweep twice, or ten times after an outage, changes nothing
 * the first run already did. That is what lets it run on a five-minute cron without anybody worrying
 * about it.
 *
 * ## Expiry revokes access and nothing else
 *
 * Founder's decision, and the right one: the warnings go out, and at the end the entitlement flips
 * off by itself. The data is untouched — rooms, rates, reservations and guests are shared with the
 * products they already pay for — so nothing is lost, and switching it back on restores everything
 * instantly. That is stated plainly in the email, because a hotel that fears losing data will not
 * start a trial at all.
 *
 * ⚠️ It **never** converts a trial into a subscription. Expiry is the only thing a machine may do;
 * keeping a product is a deliberate act by an operator. "We warned you by email" is not consent.
 */

const FIELD: Record<ProductKey, "hasChannelManager" | "hasReservation" | "hasPms"> = {
  cm: "hasChannelManager",
  crs: "hasReservation",
  pms: "hasPms",
};

export interface TrialSweepResult {
  /** Warnings that actually reached a mail provider. */
  reminded: number;
  expired: number;
  /**
   * Trials where a warning came due and there was **nobody to send it to** — no active owner with an
   * email address on the account.
   *
   * Its own number rather than folded into `reminded`, because it used to be counted as a warning
   * sent. That is the failure this project keeps finding: reporting success for something that did
   * not happen. A hotel in this state loses access on the day with no warning whatsoever, and the
   * only place that could have said so was claiming it had told them.
   */
  unreachable: number;
  /** The provider refused or was down. The threshold is still consumed — see the note below. */
  failed: number;
  details: string[];
}

export async function sweepTrials(now = new Date()): Promise<TrialSweepResult> {
  const db = forSystem();
  const running = await db.productTrial.findMany({
    where: { endedAt: null },
    orderBy: { endsAt: "asc" },
    include: {
      tenant: {
        select: {
          id: true, name: true,
          users: { where: { role: "owner", active: true }, take: 1, select: { name: true, email: true } },
        },
      },
    },
  });

  const result: TrialSweepResult = { reminded: 0, expired: 0, unreachable: 0, failed: 0, details: [] };

  /*
   * ⚠️ ONE trial, so ONE email — the state is per product, the conversation is not.
   *
   * A signup switches on all three products as three `ProductTrial` rows sharing an end date, and
   * this loop sent its own email per row. A hotel therefore received THREE "7 days left" emails,
   * three more the day before, and three "your trial has finished" — nine where there should be
   * three, each naming one product as though it were a separate subscription. That is the single
   * clearest way to contradict the thing we tell them at signup: one trial, all three products.
   *
   * So the per-trial work below is unchanged — each row still closes in its own transaction with
   * its own entitlement, and each still records its own reminder threshold — and only the SENDING
   * is gathered up per hotel. Reminders are bucketed by days-left as well as by hotel, because
   * products with different end dates (a later assisted onboarding) must not be merged into one
   * claim that they all end on the same day.
   */
  const outbox = new Map<string, {
    tenantName: string;
    email: string | null;
    expired: string[];
    reminders: Map<number, { products: string[]; endsAt: Date }>;
  }>();
  const bucketFor = (tenantId: string, tenantName: string, email: string | null) => {
    const existing = outbox.get(tenantId);
    if (existing) return existing;
    const fresh = { tenantName, email, expired: [] as string[], reminders: new Map<number, { products: string[]; endsAt: Date }>() };
    outbox.set(tenantId, fresh);
    return fresh;
  };

  for (const t of running) {
    const product = PRODUCT_BY_KEY[t.product as ProductKey];
    if (!product) continue;
    const owner = t.tenant.users[0];
    const facts = {
      product: t.product as ProductKey,
      endsAt: t.endsAt,
      endedAt: t.endedAt,
      remindedDays: [
        ...(t.remindedAt7 ? [7] : []),
        ...(t.remindedAt1 ? [1] : []),
      ],
    };

    // ── expiry first: a trial past its end has no warning left to give ────────────────────────
    if (needsExpiring(facts, now)) {
      /*
       * The trial and the entitlement are one business transition, so they commit together.
       * Closing first in a separate transaction used to strand access ON forever when the second
       * write failed: the next sweep ignored the already-ended row and never retried revocation.
       * The conditional close also makes two concurrent sweep processes harmless.
       */
      const expired = await withSystemTransaction(async (tx) => {
        const closed = await tx.productTrial.updateMany({
          where: { id: t.id, endedAt: null },
          data: { endedAt: now, outcome: "expired" },
        });
        if (closed.count === 0) return false;
        await tx.tenant.update({
          where: { id: t.tenantId },
          data: { [FIELD[t.product as ProductKey]]: false },
        });
        return true;
      });
      if (!expired) continue;

      bucketFor(t.tenantId, t.tenant.name, owner?.email ?? null).expired.push(product.name);

      result.expired++;
      result.details.push(
        owner?.email
          ? `${t.tenant.name}: ${product.name} trial expired, access removed`
          : `${t.tenant.name}: ${product.name} trial expired, access removed — NOBODY WAS TOLD (no active owner with an email)`,
      );
      if (!owner?.email) result.unreachable++;
      continue;
    }

    // ── otherwise, is a warning due? ──────────────────────────────────────────────────────────
    const due = dueReminder(facts, now);
    if (!due) continue;

    const left = daysRemaining(facts, now);
    if (owner?.email) {
      /*
       * The threshold is consumed here, before the send, and stays consumed even if the send later
       * fails.
       *
       * Deliberate: the alternative is retrying every five minutes for the rest of the trial, which
       * turns one failed send into a hundred attempts and, if the provider recovers mid-way, a
       * burst of identical warnings. One warning missed is recoverable; a hotel receiving twenty is
       * not. A failure is REPORTED as a failure rather than counted as sent.
       */
      await db.productTrial.update({
        where: { id: t.id },
        data: due === 7 ? { remindedAt7: now } : { remindedAt1: now },
      });
      const bucket = bucketFor(t.tenantId, t.tenant.name, owner.email);
      const at = bucket.reminders.get(left) ?? { products: [], endsAt: t.endsAt };
      at.products.push(product.name);
      bucket.reminders.set(left, at);
      continue;
    }

    /*
     * Nobody to tell, and the threshold is deliberately NOT consumed.
     *
     * The retry-storm reasoning above does not apply here: with no recipient there is no send to
     * retry, so nothing floods. And a missing owner email is a FIXABLE condition — recording the
     * threshold would mean that adding an owner tomorrow still never produces the warning, which
     * turns a five-minute repair into a permanent loss.
     *
     * Counted separately and named in the details, because this hotel is on course to lose access
     * on the day with no warning at all.
     */
    result.unreachable++;
    result.details.push(
      `${t.tenant.name}: ${product.name} trial — ${left} day${left === 1 ? "" : "s"} left and NOBODY TO WARN (no active owner with an email). Add one and the warning goes on the next sweep.`,
    );
  }

  // ── one hotel, one email per event ─────────────────────────────────────────────────────────
  for (const bucket of outbox.values()) {
    if (!bucket.email) continue; // already counted as unreachable above

    if (bucket.expired.length > 0) {
      const names = listOf(bucket.expired);
      const many = bucket.expired.length > 1;
      const mail = {
        preview: `Your Revio trial has finished.`,
        heading: many ? "Your Revio trial has finished" : `Your ${names} trial has finished`,
        product: "Revio",
        blocks: [
          { p: `The trial has ended and ${names} ${many ? "are" : "is"} no longer on your Revio login.` },
          {
            p: "Nothing has been deleted. Your rooms, rates, reservations and guests are shared across the products, so they are exactly where they were — and if you decide to keep any of them, switching it back on restores everything instantly, with nothing to import.",
          },
          {
            p: many
              ? "You do not have to take all of it back. Reply and tell us which of them you actually used, and we will switch on only those."
              : "If it was useful, reply to this email and we will put it back.",
          },
          {
            note: "You have not been charged for the trial, and nothing starts on its own. If you do decide to keep it, you pay from the day you decide — we never charge for a day of the trial.",
          },
        ],
      };
      await sendEmail({
        to: [bucket.email],
        subject: many ? "Your Revio trial has finished" : `Your ${names} trial has finished`,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      }).catch(() => { /* the entitlements are already correct; the mail is the softer half */ });
    }

    for (const [left, at] of bucket.reminders) {
      const names = listOf(at.products);
      const many = at.products.length > 1;
      const day = `${left} day${left === 1 ? "" : "s"}`;
      const subject = `${day} left on your Revio trial`;
      const mail = {
        preview: `${day} left on your Revio trial.`,
        heading: `${day} left on your ${many ? "Revio" : names} trial`,
        product: "Revio",
        blocks: [
          { p: `Your trial of ${names} ends on ${at.endsAt.toISOString().slice(0, 10)}.` },
          {
            p: many
              ? "If you would like to keep any of them, reply and tell us which — you only pay for what you keep, and there is no obligation to take all three. Nothing happens automatically and you will not be charged without agreeing to it."
              : "If you would like to keep it, reply to this email and we will switch it on properly. Nothing happens automatically and you will not be charged without agreeing to it.",
          },
          { action: { label: "Open Revio", url: originFor("cm") } },
          {
            note: "If you let it run out, nothing is deleted — your data is shared across the products and stays exactly as it is.",
          },
        ],
      };
      const sent = await sendEmail({
        to: [bucket.email],
        subject,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      }).catch(() => ({ ok: false, mode: "resend" as const, error: "send threw" }));

      if (sent.ok) {
        result.reminded += at.products.length;
        result.details.push(`${bucket.tenantName}: ${day} warning sent — ${names}`);
      } else {
        // One email failing means every product it covered went unwarned. Counted as such.
        result.failed += at.products.length;
        result.details.push(`${bucket.tenantName}: ${day} warning FAILED to send — ${names} (${sent.error ?? "unknown"})`);
      }
    }
  }

  return result;
}

/** "RevioLink, RevioCRS and RevioPMS" — an and, not a third comma. */
function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
