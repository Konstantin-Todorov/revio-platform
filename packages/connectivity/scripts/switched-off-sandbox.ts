/**
 * SANDBOX ONLY — proves what `switchedOffClosures` sends does what it means at Channex: a stop-sell
 * with no price and no room count closes ONE rate, leaves the other rate of the same room open, and
 * does not touch the room's availability; sending stopSell false reopens it.
 *
 *   pnpm --filter @revio/connectivity exec tsx --env-file=.env.local scripts/switched-off-sandbox.ts
 */
import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";

const env = process.env;
if ((env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL).includes("app.channex.io")) throw new Error("sandbox only");
const a = new ChannexChannelAdapter({ apiKey: env.CHANNEX_API_KEY!, propertyId: env.CHANNEX_PROPERTY_ID!, baseUrl: env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL });
const room = env.CHANNEX_DOUBLE_ROOM_ID!, closeRate = env.CHANNEX_DOUBLE_BREAKFAST_ID!, keepRate = env.CHANNEX_DOUBLE_BAR_ID!;
const day = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

async function look(label: string) {
  const [r, av] = await Promise.all([a.readPublishedRestrictions(day, day), a.readPublishedAvailability(day, day)]);
  if (!r.ok || !av.ok) throw new Error(`read failed: ${!r.ok ? r.error : ""} ${!av.ok ? av.error : ""}`);
  const ss = (id: string) => r.rows.find((x) => x.externalRateId === id && x.date === day)?.stopSell;
  const count = av.rows.find((x) => x.externalRoomId === room && x.date === day)?.count;
  console.log(`${label.padEnd(26)} closed rate stop_sell=${ss(closeRate)} · other rate stop_sell=${ss(keepRate)} · room availability=${count}`);
  return { closed: ss(closeRate), other: ss(keepRate), count };
}

const before = await look("before");
const push = (stopSell: boolean) => a.pushAri([{ externalRoomId: room, externalRateId: closeRate, date: day, currency: "EUR", restrictions: { stopSell } }]);
const p1 = await push(true);
console.log("push close:", p1.ok ? "ok" : JSON.stringify(p1.rejected.slice(0, 2)));
await new Promise((r) => setTimeout(r, 4000));
const after = await look("after switch-off closure");
const p2 = await push(false);
console.log("push reopen:", p2.ok ? "ok" : JSON.stringify(p2.rejected.slice(0, 2)));
await new Promise((r) => setTimeout(r, 4000));
const reopened = await look("after switch-on");
const pass = after.closed === true && after.other === before.other && after.count === before.count && reopened.closed === false;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
