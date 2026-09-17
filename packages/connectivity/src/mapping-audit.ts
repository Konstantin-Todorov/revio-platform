/**
 * Ask the channel what its rate plans actually belong to, and write the answer down.
 *
 * ## The fault this exists for
 *
 * A rate-plan mapping can point at the right channel and the wrong room. Channex holds one rate
 * plan per room type and several of them carry the same title, so picking the wrong UUID produces a
 * row that reads `mapped`, a push that reports success and a channel that accepts every update —
 * while one room's prices and availability publish against another. It has happened twice on real
 * property (13 and 17 September), and nothing in the platform could see it.
 *
 * `crossWiredRatePlans` decides it. This is what feeds it, nightly, for every hotel.
 *
 * ## ⚠️ Why the answer is STORED rather than asked when a screen renders
 *
 * The hotel's own Mapping screen can compare live, because it lists the catalogue on every render
 * anyway. The Operator console cannot: it shows every client at once and would need one Channex
 * request per client per page load. A fault that only the hotel's screen can see is a fault nobody
 * sees until the hotel telephones — which is precisely how we learned about the last one.
 *
 * So each mapping row records what the channel said about the plan it points at, and the question
 * "is this cross-wired?" becomes a plain join, answerable from both perimeters at no cost.
 *
 * ## ⚠️ An empty catalogue is never treated as an empty account
 *
 * `listChannelProducts` swallows its errors and returns empty lists, and an unauthenticated Channex
 * request answers 401 with no `data` key. Both arrive here as "zero rate plans". Writing that down
 * would mark every mapping in the hotel as pointing at a plan the channel does not have — turning
 * one revoked key into a screen full of invented faults. Zero plans means we did not get an answer,
 * and nothing is written.
 */

import { forTenant } from "@revio/db";
import { crossWiredRatePlans, describeCrossWire, type CrossWired } from "@revio/core";
import { listChannelProducts, verifyChannelProperty } from "./sync.js";
import { ensureChannexWebhook } from "./channex-webhook.js";

type Db = ReturnType<typeof forTenant>;

export interface MappingAuditResult {
  channelId: string;
  channelName: string;
  /** What the webhook check did, when it ran. Absent when the property is unreachable anyway. */
  webhook?: "registered" | "already" | "failed";
  /** Mapping rows whose catalogue answer we recorded. */
  checked: number;
  crossWired: CrossWired[];
  /** Error Center entries created — one per fault that did not already have an open one. */
  raised: number;
  /**
   * Why nothing was recorded, when nothing was. Present means the run is inconclusive, NOT clean —
   * the difference this whole module is careful about.
   */
  skipped?: string;
}

/**
 * Record what the channel says about every rate plan this channel is mapped to, and raise the
 * cross-wires.
 *
 * Writes nothing when the channel cannot be listed. A channel that does not scope its plans by room
 * at all (our mock, so both demo hotels) is recorded as checked and accused of nothing: the pure
 * check skips a plan whose room the channel would not name.
 */
export async function auditChannelMapping(
  prisma: Db,
  channelId: string,
  /**
   * Where Channex should ring us, and the secret it sends back. Passed in rather than read from the
   * environment here: only the app knows its own public origin, and `req.nextUrl.origin` behind
   * Railway's proxy is `localhost` — a mistake this codebase has already shipped once.
   */
  webhookCallbackUrl?: string,
  webhookSecret?: string,
): Promise<MappingAuditResult> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return { channelId, channelName: "unknown", checked: 0, crossWired: [], raised: 0, skipped: "no such channel" };
  }
  const base = { channelId, channelName: channel.name };

  /*
   * ⚠️ FIRST, because everything after it is unreadable without the answer.
   *
   * Ventsi Group · Chervena Vila has been logging "Pulled 0 revisions · success" every five minutes
   * against a property Channex 404s. A filter on an id that does not exist is not an error — the
   * request succeeds, the list is empty, and the status-code check that fixed the 2026-09-01 outage
   * agrees that everything is fine. Without this, the audit would go on to report "the channel
   * listed no rate plans", which is true and is the wrong sentence: it describes an empty catalogue
   * when the catalogue does not exist.
   */
  const prop = await verifyChannelProperty(prisma, channelId);
  const markChannel = (catalogueStatus: string) =>
    prisma.channel.update({ where: { id: channelId }, data: { catalogueStatus, catalogueCheckedAt: new Date() } });

  if (!prop.ok && prop.status === 404) {
    await markChannel("property_missing");
    // The count is what raiseOnce actually did, not what we asked it to do: an open entry already
    // saying this raises nothing, and a job whose own log overstates its work is a job nobody trusts.
    const raised = await raiseOnce(prisma, channel, {
      code: "channel_property_missing",
      productLabel: channel.name,
      message:
        `${channel.name} no longer has the property this channel is connected to. Nothing sent is arriving, ` +
        `and nothing can arrive back — the syncs that report success are reaching an empty filter, not your listings.`,
      recommendedAction:
        `The property was deleted or recreated on ${channel.name}. Reconnect the channel so it is set up again, ` +
        `then re-map the room types and rate plans. Until then this channel is doing nothing, quietly.`,
    });
    return { ...base, checked: 0, crossWired: [], raised, skipped: "the channel 404s the property this channel points at" };
  }

  /*
   * ⚠️ The webhook is CHECKED nightly, not registered once and forgotten.
   *
   * Registering at connect time and never looking again is the shape of defect this codebase keeps
   * producing: a thing that is correct on the day it is built and silently stops. A webhook deleted
   * on Channex's side, or one that was never created because a connect half-failed, produces no
   * error anywhere — bookings simply go back to arriving up to five minutes late, which nobody would
   * ever notice. `ensureChannexWebhook` is idempotent, so on almost every night this is one GET.
   *
   * It is deliberately NOT allowed to fail the audit: the mapping check is the point of this job and
   * a webhook is an optimisation on top of a poll that still runs.
   */
  let webhook: MappingAuditResult["webhook"];
  if (webhookCallbackUrl && webhookSecret) {
    const w = await ensureChannexWebhook(channel.propertyId, webhookCallbackUrl, webhookSecret);
    webhook = w.ok ? (w.unchanged ? "already" : "registered") : "failed";
  }

  const products = await listChannelProducts(prisma, channelId);
  if (products.rates.length === 0) {
    // See the header: zero is "no answer", never "no plans".
    await markChannel("unreadable");
    return { ...base, checked: 0, crossWired: [], raised: 0, ...(webhook ? { webhook } : {}), skipped: "the channel listed no rate plans — treated as unknown" };
  }
  await markChannel("ok");

  const [rateMaps, roomMaps] = await Promise.all([
    prisma.channelRatePlanMapping.findMany({ where: { channelId }, include: { ratePlan: true, roomType: true } }),
    prisma.channelRoomTypeMapping.findMany({ where: { channelId }, include: { roomType: true } }),
  ]);

  const planRoom = new Map(products.rates.map((r) => [r.id, r.roomTypeId ?? null] as const));
  const channelRoomName = new Map(products.rooms.map((r) => [r.id, r.name] as const));
  const ourRoomExternalId = new Map(
    roomMaps.flatMap((m) => (m.externalRoomId ? [[m.roomTypeId, m.externalRoomId] as const] : [])),
  );

  /*
   * ⚠️ `catalogueCheckedAt` set with `externalRoomIdSeen` null is NOT the same as both null.
   *
   * Both null = never asked. Timestamp with no room = asked, and the channel could not place the
   * plan — either it no longer has that id, or it does not scope plans by room. The screens tell
   * those apart, so the write has to.
   */
  const now = new Date();
  let checked = 0;
  for (const m of rateMaps) {
    if (!m.externalRateId) continue;
    await prisma.channelRatePlanMapping.update({
      where: { id: m.id },
      data: { externalRoomIdSeen: planRoom.get(m.externalRateId) ?? null, catalogueCheckedAt: now },
    });
    checked++;
  }

  /*
   * Only room-scoped rows are judged. A catch-all row (`roomTypeId` null) is a different, older
   * fault that the mapping screen already names in its own words, and reporting it twice under two
   * names is how a hotel learns to stop reading the first one.
   */
  const crossWired = crossWiredRatePlans(
    rateMaps.flatMap((m) =>
      m.externalRateId && m.roomTypeId && m.roomType
        ? [{
            roomTypeId: m.roomTypeId,
            roomTypeName: m.roomType.name,
            ratePlanName: m.ratePlan.name,
            externalRateId: m.externalRateId,
          }]
        : [],
    ),
    products.rates.map((r) => ({ id: r.id, title: r.name, externalRoomId: r.roomTypeId ?? null })),
    ourRoomExternalId,
    channelRoomName,
  );

  let raised = 0;
  for (const f of crossWired) {
    raised += await raiseOnce(prisma, channel, {
      code: "mapping_cross_wired",
      productLabel: `${f.roomTypeName} · ${f.ratePlanName}`,
      message: describeCrossWire(f),
      recommendedAction:
        f.reason === "wrong_room"
          ? `Open Mapping, find ${f.roomTypeName} · ${f.ratePlanName}, and pick the rate plan ${channel.name} lists under ${f.roomTypeName}. Marking this resolved changes nothing — the prices keep going to the wrong room until the id does.`
          : `Open Mapping and re-pick the rate plan for ${f.roomTypeName} · ${f.ratePlanName}. The id it holds no longer exists on ${channel.name}, so nothing sent for it is arriving.`,
    });
  }

  return { ...base, checked, crossWired, raised, ...(webhook ? { webhook } : {}) };
}

/**
 * Raise a critical Error Center entry, unless an OPEN one already says the same thing.
 *
 * ⚠️ Idempotent on an OPEN entry, not on any entry. Press Resolve while the fault is still true and
 * it comes back on the next run, because the condition is still true. That is the lesson of
 * 15 September, where resolving an error dismissed the reminder and imported nothing.
 */
async function raiseOnce(
  prisma: Db,
  channel: { id: string; tenantId: string; propertyId: string },
  e: { code: string; productLabel: string; message: string; recommendedAction: string },
): Promise<number> {
  const open = await prisma.errorItem.findFirst({
    where: { channelId: channel.id, code: e.code, productLabel: e.productLabel, resolved: false },
  });
  if (open) return 0;
  await prisma.errorItem.create({
    data: {
      tenantId: channel.tenantId,
      propertyId: channel.propertyId,
      channelId: channel.id,
      severity: "critical",
      code: e.code,
      message: e.message,
      productLabel: e.productLabel,
      recommendedAction: e.recommendedAction,
    },
  });
  return 1;
}
