/**
 * Every night, read what each live channel is PUBLISHING and compare it with what we send.
 *
 * ## Why this is scheduled
 *
 * The Verify button and `channex:readback` have been able to do this since 2026-09-23, and they
 * ran exactly when somebody remembered to press them. The fault they catch has no symptom on our
 * side: every push reports success, the Sync Center is green, and the OTA sells a different price
 * or a different number of rooms. The hotel learns from a guest. A check that waits to be asked is
 * a check that runs after the guest has booked.
 *
 * ## What counts as a fault, and what deliberately does not
 *
 * The first production read (2026-09-29) reported 93 prices "different" and 186 "we did not send",
 * and not one of them was a push fault:
 *
 * - **A plan Channex derives from another** (BB Non-Refundable = BB BAR −10%) ignores the price we
 *   send. Channex computes it. Reported by NAME in the summary, never counted — it is a setting in
 *   Channex, not something a re-send can change, and an alert that fires every night for a setting
 *   is an alert people learn to delete.
 * - **A plan we do not send to at all** carries prices somebody else put there. Not ours to judge.
 *   A price on a plan we DO map, on a night we sent nothing for, still counts: that is the shape a
 *   mis-mapping leaves on the room it wrongly wrote to.
 *
 * What remains — a wrong price, a price that never arrived, a room count that differs — is a fault.
 *
 * ## Re-send first, then alert
 *
 * The commonest cause of a difference is a push that was dropped: a network blip, a deploy
 * mid-push. So a difference is re-sent once and read again, and only what survives the re-send
 * reaches a person. A healed difference is still written to the Sync Center, because a channel that
 * needs healing every night is its own finding.
 *
 * ## Who is not read
 *
 * Mock channels (they read back what they were sent — a green result would mean nothing), channels
 * that are paused or disconnected (nothing is sent on purpose), and suspended or closed accounts:
 * their distribution is stopped until someone reinstates them, so comparing it with what we "send"
 * compares it with nothing. That is also why DesManagement is not read while it is suspended.
 */

import { forTenant } from "@revio/db";
import type { PublishedComparison } from "./published-check.js";
import {
  suspendedReason, syncChannel, verifyPublished, verifyPublishedAvailability,
  type AvailabilityCheck,
} from "./sync.js";
import { raiseOnce } from "./mapping-audit.js";

type Db = ReturnType<typeof forTenant>;

/** How far ahead to read. Both reads are one request each whatever the range. */
export const READ_BACK_DAYS = 60;

export const READ_BACK_ERROR_CODE = "channel_publishes_differently";

export interface ReadBackJudgement {
  /** Priced nights still different — wrong price, never arrived, or priced on a plan we map but did not send. */
  priceFaults: number;
  /** Room-nights offered at a different count. */
  roomFaults: number;
  /** Plans whose difference is Channex computing them itself. Names, for the summary. */
  derivedPlans: string[];
  /** A few lines somebody can act on without opening anything. */
  examples: string[];
  headline: string;
}

const money = (minor: number | null) => (minor == null ? "nothing" : (minor / 100).toFixed(2));

/**
 * Decide which differences are faults. Pure: the reads happen elsewhere.
 *
 * `mappedRateIds` is the channel's plan ids we actively send to — the same set the push uses.
 */
export function judgeReadBack(input: {
  priceProblems: readonly PublishedComparison[];
  channelPlans?: Record<string, { name: string; derivedFrom?: string }> | undefined;
  mappedRateIds: ReadonlySet<string>;
  rooms: Pick<AvailabilityCheck, "mismatched" | "examples">;
}): ReadBackJudgement {
  const derived = new Set<string>();
  const faults: PublishedComparison[] = [];
  for (const p of input.priceProblems) {
    const plan = input.channelPlans?.[p.externalRateId];
    if (plan?.derivedFrom) {
      derived.add(`${plan.name} (from ${plan.derivedFrom})`);
      continue;
    }
    if (p.kind === "unexpected" && !input.mappedRateIds.has(p.externalRateId)) continue;
    faults.push(p);
  }

  const examples: string[] = [];
  for (const f of faults.slice(0, 3)) {
    const what = f.roomTypeName ? `${f.roomTypeName} · ${f.ratePlanName}` : input.channelPlans?.[f.externalRateId]?.name ?? f.externalRateId;
    examples.push(
      f.kind === "missing"
        ? `${what} ${f.date}: we send ${money(f.ours)}, the channel shows no price`
        : f.kind === "unexpected"
          ? `${what} ${f.date}: the channel sells at ${money(f.theirs)}, we send no price that night`
          : `${what} ${f.date}: we send ${money(f.ours)}, the channel sells at ${money(f.theirs)}`,
    );
  }
  for (const r of input.rooms.examples.slice(0, 3)) {
    examples.push(`${r.roomTypeName} ${r.date}: we send ${r.ours} room${r.ours === 1 ? "" : "s"}, the channel offers ${r.theirs ?? "none"}`);
  }

  const priceFaults = faults.length;
  const roomFaults = input.rooms.mismatched;
  const parts = [
    priceFaults ? `${priceFaults} priced night${priceFaults === 1 ? "" : "s"}` : null,
    roomFaults ? `${roomFaults} room-night${roomFaults === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const derivedPlans = [...derived].sort();
  const headline =
    (parts.length ? `${parts.join(" and ")} published differently from what we send` : "Publishing exactly what we send") +
    (derivedPlans.length ? `. Channex computes ${derivedPlans.join(", ")} itself and ignores our price for it` : "");

  return { priceFaults, roomFaults, derivedPlans, examples, headline };
}

export interface ReadBackResult {
  channelId: string;
  channelName: string;
  status: "ok" | "healed" | "differs" | "unreadable" | "skipped";
  faults: number;
  summary: string;
  /** Error Center entries opened (0 or 1) and closed. */
  raised: number;
  resolved: number;
}

/**
 * Read one channel back, re-send once if it differs, record the answer on the channel, and open or
 * close the hotel's Error Center entry to match.
 *
 * Writes nothing when it could not read — beyond saying so. An unreadable channel is never recorded
 * as clean, and never as faulty either.
 */
export async function readBackChannel(
  prisma: Db,
  channelId: string,
  opts: { days?: number; heal?: boolean; settleMs?: number } = {},
): Promise<ReadBackResult> {
  const days = opts.days ?? READ_BACK_DAYS;
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  const skip = (summary: string): ReadBackResult => ({
    channelId, channelName: channel?.name ?? "unknown", status: "skipped", faults: 0, summary, raised: 0, resolved: 0,
  });
  if (!channel) return skip("no such channel");
  if (channel.connectivityMode === "mock") return skip("demo channel — it reads back what it was sent");
  if (channel.status !== "connected") return skip(`channel is ${channel.status}`);
  const suspended = await suspendedReason(prisma, channel.tenantId);
  if (suspended) return skip(suspended);

  const mapped = await prisma.channelRatePlanMapping.findMany({
    where: { channelId, status: "complete", externalRateId: { not: null }, ratePlan: { active: true } },
    select: { externalRateId: true },
  });
  const mappedRateIds = new Set(mapped.map((m) => m.externalRateId!));

  const read = async (): Promise<{ ok: true; j: ReadBackJudgement } | { ok: false; error: string }> => {
    const [rates, rooms] = await Promise.all([
      verifyPublished(prisma, channelId, days),
      verifyPublishedAvailability(prisma, channelId, days),
    ]);
    if (!rates.ok) return { ok: false, error: `prices: ${rates.error ?? "could not read"}` };
    if (!rooms.ok) return { ok: false, error: `rooms: ${rooms.error ?? "could not read"}` };
    return { ok: true, j: judgeReadBack({ priceProblems: rates.problems ?? [], channelPlans: rates.channelPlans, mappedRateIds, rooms }) };
  };

  const first = await read();
  if (!first.ok) {
    await prisma.channel.update({
      where: { id: channelId },
      data: { readBackAt: new Date(), readBackStatus: "unreadable", readBackSummary: `Could not read the channel back — ${first.error}` },
    });
    return { channelId, channelName: channel.name, status: "unreadable", faults: 0, summary: first.error, raised: 0, resolved: 0 };
  }

  let final = first.j;
  let resent = false;
  const firstFaults = first.j.priceFaults + first.j.roomFaults;
  if (firstFaults > 0 && opts.heal !== false) {
    const outcome = await syncChannel(prisma, channelId, { horizonDays: days + 1 });
    resent = outcome.ok;
    if (opts.settleMs) await new Promise((r) => setTimeout(r, opts.settleMs));
    const again = await read();
    // A second read that fails is not a clean bill of health: keep what the first read found.
    if (again.ok) final = again.j;
  }
  const faults = final.priceFaults + final.roomFaults;
  const status: ReadBackResult["status"] = faults > 0 ? "differs" : resent ? "healed" : "ok";
  const summary = [final.headline, ...final.examples].join(" · ");

  await prisma.channel.update({
    where: { id: channelId },
    data: { readBackAt: new Date(), readBackStatus: status, readBackFaults: faults, readBackSummary: summary },
  });

  let raised = 0;
  let resolved = 0;
  if (status === "differs") {
    raised = await raiseOnce(prisma, channel, {
      code: READ_BACK_ERROR_CODE,
      productLabel: channel.name,
      message: `${channel.name} is not selling what Revio sends: ${final.headline}.${final.examples.length ? ` For example — ${final.examples.join("; ")}.` : ""}`,
      recommendedAction:
        (resent
          ? `We re-sent everything and read ${channel.name} again, and it still differs — so this is not a dropped update. `
          : `Send everything again from the Channels screen (the sync arrows) first; if it still differs, this is not a dropped update. `) +
        `Check the room and rate mapping for the rooms named here, and any rule set directly in the channel's extranet. ` +
        `Guests are booking at the channel's numbers until it matches.`,
    });
  } else {
    const r = await prisma.errorItem.updateMany({
      where: { channelId, code: READ_BACK_ERROR_CODE, resolved: false },
      data: { resolved: true },
    });
    resolved = r.count;
  }

  if (firstFaults > 0) {
    await prisma.syncEvent.create({
      data: {
        tenantId: channel.tenantId, propertyId: channel.propertyId, channelId, kind: "push",
        status: status === "differs" ? "failed" : "success",
        summary: status === "differs"
          ? `Nightly check: ${channel.name} publishes ${faults} night${faults === 1 ? "" : "s"} differently from what we send${resent ? ", even after a full re-send" : ""}`
          : `Nightly check: ${channel.name} was publishing ${firstFaults} night${firstFaults === 1 ? "" : "s"} differently — re-sent, and it now matches`,
        detail: [first.j.headline, ...first.j.examples].join("\n"),
      },
    });
  }

  return { channelId, channelName: channel.name, status, faults, summary, raised, resolved };
}
