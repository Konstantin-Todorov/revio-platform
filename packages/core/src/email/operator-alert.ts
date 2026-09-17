/**
 * The mail that tells US something needs doing.
 *
 * ## ⚠️ Why this exists
 *
 * By 2026-09-17 this platform could detect a great deal: a booking a channel confirmed that we could
 * not import, a rate plan publishing to the wrong room, a channel pointed at a property the channel
 * has deleted. Every one of those landed in the Operator console **and nowhere else**. If nobody
 * opened that screen, nobody found out — which is the same shape as the failure the whole day was
 * spent removing, only with us in the hotel's place.
 *
 * A real client's booking sat unimported for two days and the first thing that noticed was a
 * support thread.
 *
 * ## ⚠️ Silence is a feature, and it is the hard part
 *
 * A digest that arrives every hour saying "nothing to report" is a digest people filter to a folder,
 * and then the one that matters is filtered too. So:
 *
 *   * **Nothing to say → nothing sent.** Not an empty mail, not a "all clear" line.
 *   * **A fault already reported is not reported again**, however many times the job runs. The
 *     console is where you go to see what is still open; the mail is for what is *new*.
 *   * **Except that a fault nobody has fixed is re-raised after `NAG_DAYS`**, because "we told you
 *     once, three weeks ago" is how something stays broken. The reminder says how long it has been.
 *
 * That last rule is the whole difference between an alert and a notification.
 */

import { renderSystemEmail, renderSystemEmailText, type SystemEmailBlock } from "./system-shell.js";
import type { AuthEmail } from "./auth-emails.js";

/** A fault we have already told somebody about, as stored. */
export interface AlertRecord {
  /** Stable across runs: what KIND of fault, for what THING. Two runs of the same fault share it. */
  key: string;
  firstSeenAt: Date;
  lastAlertedAt: Date;
}

/** A fault as the console currently sees it. */
export interface AlertCandidate {
  key: string;
  /** Which client it concerns, in the words we use for them. */
  clientName: string;
  /** One line, leading with the consequence. */
  summary: string;
  /** What to do about it. */
  action: string;
  /** `act` is shown first and is the only severity that can be in the subject line. */
  severity: "act" | "soon";
}

export interface AlertDecision {
  /** New since the last mail — worth interrupting somebody for. */
  fresh: AlertCandidate[];
  /**
   * Open for a while and still not fixed. Carried with their age so the mail can say it.
   */
  stale: (AlertCandidate & { openDays: number })[];
  /** Nothing to say. The caller sends no mail at all. */
  silent: boolean;
}

/** A fault nobody has fixed is raised again after this long. */
export const NAG_DAYS = 3;

const DAY = 86_400_000;

/**
 * What this run should actually say, given what we have already said.
 *
 * Pure: candidates and history in, a decision out. The clock is a parameter so the nag rule can be
 * tested without waiting three days.
 */
export function decideAlerts(
  candidates: readonly AlertCandidate[],
  known: readonly AlertRecord[],
  now: Date,
): AlertDecision {
  const byKey = new Map(known.map((k) => [k.key, k]));
  const fresh: AlertCandidate[] = [];
  const stale: (AlertCandidate & { openDays: number })[] = [];

  for (const c of candidates) {
    const seen = byKey.get(c.key);
    if (!seen) {
      fresh.push(c);
      continue;
    }
    const sinceAlert = now.getTime() - seen.lastAlertedAt.getTime();
    if (sinceAlert >= NAG_DAYS * DAY) {
      stale.push({ ...c, openDays: Math.floor((now.getTime() - seen.firstSeenAt.getTime()) / DAY) });
    }
  }

  const rank = (s: AlertCandidate["severity"]) => (s === "act" ? 0 : 1);
  fresh.sort((a, b) => rank(a.severity) - rank(b.severity));
  stale.sort((a, b) => b.openDays - a.openDays);

  return { fresh, stale, silent: fresh.length === 0 && stale.length === 0 };
}

/**
 * The mail itself.
 *
 * ⚠️ The subject names the worst thing and the client it belongs to, because a subject line is the
 * only part that is read on a phone at the wrong moment. "3 things need attention" is a subject
 * somebody opens later; "Cabacum Beach Residence — a booking never reached the calendar" is one they
 * open now.
 */
export function operatorAlertEmail(d: AlertDecision, consoleUrl: string): AuthEmail {
  const all = [...d.fresh, ...d.stale];
  const lead = all[0];
  const subject =
    all.length === 1
      ? `${lead!.clientName} — ${lead!.summary.split(".")[0]}`
      : `${lead!.clientName} — ${lead!.summary.split(".")[0]} (and ${all.length - 1} more)`;

  const blocks: SystemEmailBlock[] = [];

  if (d.fresh.length > 0) {
    blocks.push({ p: d.fresh.length === 1 ? "One new thing needs attention." : `${d.fresh.length} new things need attention.` });
    blocks.push({ list: d.fresh.map((c) => `${c.clientName} · ${c.summary} → ${c.action}`) });
  }
  if (d.stale.length > 0) {
    blocks.push({
      p:
        d.stale.length === 1
          ? "And one that was reported before and is still open:"
          : `And ${d.stale.length} reported before and still open:`,
    });
    blocks.push({
      list: d.stale.map((c) => `${c.clientName} · ${c.summary} — open ${c.openDays} day${c.openDays === 1 ? "" : "s"} → ${c.action}`),
    });
  }

  blocks.push({ action: { label: "Open the console", url: consoleUrl } });
  blocks.push({
    // Says the rule out loud, so an empty inbox is read as "nothing wrong" and not as "it broke".
    note:
      "You get this only when something is new, or when something reported earlier is still open after " +
      `${NAG_DAYS} days. No mail means nothing needs doing.`,
  });

  const args = {
    preview: all.length === 1 ? lead!.summary : `${all.length} things across the portfolio.`,
    heading: d.fresh.length > 0 ? "Something needs doing" : "Still open",
    blocks,
  };

  return { subject, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}
