import "server-only";
import { forSystem } from "@revio/db";
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
  reminded: number;
  expired: number;
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

  const result: TrialSweepResult = { reminded: 0, expired: 0, details: [] };

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
       * Close the trial and revoke in one place, and close it FIRST.
       *
       * If the entitlement write failed after the trial was closed, the hotel keeps access they are
       * no longer paying for — visible, recoverable, and in their favour. The other order risks
       * revoking access while the trial still looks running, which the next sweep would try to
       * revoke again and which reads to the hotel as an unexplained outage.
       */
      await db.productTrial.update({
        where: { id: t.id },
        data: { endedAt: now, outcome: "expired" },
      });
      await db.tenant.update({
        where: { id: t.tenantId },
        data: { [FIELD[t.product as ProductKey]]: false },
      });

      if (owner?.email) {
        const mail = {
          preview: `Your ${product.name} trial has finished.`,
          heading: `Your ${product.name} trial has finished`,
          product: product.name,
          blocks: [
            { p: `The trial has ended and ${product.name} is no longer on your Revio login.` },
            {
              p: "Nothing has been deleted. Your rooms, rates, reservations and guests are shared with the products you already use, so they are exactly where they were — and if you decide to keep it, switching it back on restores everything instantly, with nothing to import.",
            },
            { p: "If it was useful, reply to this email and we will put it back." },
            { note: "You have not been charged for the trial, and nothing starts on its own." },
          ],
        };
        await sendEmail({
          to: [owner.email],
          subject: `Your ${product.name} trial has finished`,
          text: renderSystemEmailText(mail),
          html: renderSystemEmail(mail),
        }).catch(() => { /* the entitlement is already correct; the mail is the softer half */ });
      }

      result.expired++;
      result.details.push(`${t.tenant.name}: ${product.name} trial expired, access removed`);
      continue;
    }

    // ── otherwise, is a warning due? ──────────────────────────────────────────────────────────
    const due = dueReminder(facts, now);
    if (!due) continue;

    const left = daysRemaining(facts, now);
    if (owner?.email) {
      const mail = {
        preview: `${left} day${left === 1 ? "" : "s"} left on your ${product.name} trial.`,
        heading: `${left} day${left === 1 ? "" : "s"} left on your ${product.name} trial`,
        product: product.name,
        blocks: [
          { p: `Your trial of ${product.name} ends on ${t.endsAt.toISOString().slice(0, 10)}.` },
          {
            p: "If you would like to keep it, reply to this email and we will switch it on properly. Nothing happens automatically and you will not be charged without agreeing to it.",
          },
          { action: { label: `Open ${product.name}`, url: originFor(t.product as ProductKey) } },
          {
            note: "If you let it run out, nothing is deleted — your data is shared with the products you already use and stays exactly as it is.",
          },
        ],
      };
      await sendEmail({
        to: [owner.email],
        subject: `${left} day${left === 1 ? "" : "s"} left on your ${product.name} trial`,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      }).catch(() => { /* recorded as sent below either way — see the note */ });
    }

    /*
     * Recorded as sent even when the mail failed.
     *
     * Deliberate: the alternative is retrying every five minutes for the rest of the trial, which
     * turns one failed send into a hundred attempts and, if the provider recovers mid-way, a burst
     * of identical warnings. One warning missed is recoverable; a hotel receiving twenty is not.
     */
    await db.productTrial.update({
      where: { id: t.id },
      data: due === 7 ? { remindedAt7: now } : { remindedAt1: now },
    });
    result.reminded++;
    result.details.push(`${t.tenant.name}: ${product.name} trial — ${left}-day warning sent`);
  }

  return result;
}
