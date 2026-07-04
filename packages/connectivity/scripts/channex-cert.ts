/**
 * Run the Channex PMS-certification ARI scenarios (tests 1–10) against the sandbox and print the
 * Channex **task ids** to paste into the certification form. Each scenario uses the same adapter
 * methods RevioLink uses in production, over the cert data model (2 room types × 2 rate plans).
 *
 *   pnpm --filter @revio/connectivity channex:cert
 *
 * Requires the cert vars in .env.local (run channex:cert-setup first): CHANNEX_DOUBLE_ROOM_ID,
 * CHANNEX_TWIN_ROOM_ID, CHANNEX_{DOUBLE,TWIN}_{BAR,BREAKFAST}_ID.
 *
 * NOTE: task ids prove the adapter produces correct Channex calls, and pre-fill the form. The live
 * screenshare additionally requires each change to originate from the RevioLink UI (see
 * docs/CHANNEX-CERTIFICATION.md) — that is the calendar → push wiring, not this script.
 */

import { ChannexChannelAdapter, CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";
import type { AriUpdate } from "@revio/core";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY!;
const propertyId = env.CHANNEX_PROPERTY_ID!;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

const DOUBLE = env.CHANNEX_DOUBLE_ROOM_ID!;
const TWIN = env.CHANNEX_TWIN_ROOM_ID!;
const DOUBLE_BAR = env.CHANNEX_DOUBLE_BAR_ID!;
const DOUBLE_BF = env.CHANNEX_DOUBLE_BREAKFAST_ID!;
const TWIN_BAR = env.CHANNEX_TWIN_BAR_ID!;
const TWIN_BF = env.CHANNEX_TWIN_BREAKFAST_ID!;

// Which room each rate plan belongs to (availability is per room).
const RATE_ROOM: Record<string, string> = {
  [DOUBLE_BAR]: DOUBLE, [DOUBLE_BF]: DOUBLE, [TWIN_BAR]: TWIN, [TWIN_BF]: TWIN,
};
const ALL_RATES = [DOUBLE_BAR, DOUBLE_BF, TWIN_BAR, TWIN_BF];

const adapter = new ChannexChannelAdapter({ apiKey, propertyId, baseUrl, channelCode: "channex-sandbox" });
const results: { test: string; taskIds: string[]; note: string }[] = [];

function ymd(d: string | number): string {
  if (typeof d === "string") return d;
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
}

/** One AriUpdate. Availability is resolved from the rate plan's room. */
function u(rate: string, date: string, opts: Partial<AriUpdate> & { restrictions?: AriUpdate["restrictions"] }): AriUpdate {
  return {
    externalRoomId: RATE_ROOM[rate]!,
    externalRateId: rate,
    date,
    bookable: opts.bookable ?? 5,
    priceMinor: opts.priceMinor ?? 12000,
    currency: "EUR",
    restrictions: opts.restrictions ?? { stopSell: false, cta: false, ctd: false },
  };
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

async function main() {
  if (!apiKey || !DOUBLE || !TWIN_BF) {
    console.log("Missing cert env — run `channex:cert-setup` and add the printed vars to .env.local.");
    return;
  }
  console.log(`Channex PMS certification run · property ${propertyId}\n`);

  // ---- Test 1: Full sync — 500 days, all rooms + rate plans, realistic variation (≤2 calls) ----
  {
    const days = dateRange(ymd(0), ymd(499));
    const updates: AriUpdate[] = [];
    for (const rate of ALL_RATES) {
      const base = rate === DOUBLE_BAR ? 12000 : rate === DOUBLE_BF ? 14000 : rate === TWIN_BAR ? 11000 : 13000;
      days.forEach((date, i) => {
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        const weekend = dow === 5 || dow === 6;
        const seasonal = Math.round(Math.sin(i / 58) * 1500); // gentle seasonal swing
        updates.push(u(rate, date, {
          priceMinor: base + (weekend ? 2500 : 0) + seasonal,
          bookable: RATE_ROOM[rate] === TWIN ? 8 : 6,
          restrictions: { minLos: weekend ? 2 : 1, stopSell: false, cta: false, ctd: false },
        }));
      });
    }
    const rr = await adapter.pushRatesAndRestrictions(updates);
    const av = await adapter.pushAvailability(updates);
    record("1 · Full sync (500 days, 2 rooms, 4 rates)", [rr.taskId, av.taskId], `${updates.length} rate-days in 2 calls`);
  }

  // ---- Test 2: Single date, single rate — Twin/BAR 22 Nov 2026 = €333 ----
  {
    const r = await adapter.pushRatesAndRestrictions([u(TWIN_BAR, "2026-11-22", { priceMinor: 33300 })]);
    record("2 · Single date, single rate (Twin/BAR 22 Nov = €333)", [r.taskId], "1 rates call");
  }

  // ---- Test 3: Single date, multiple rates — batched into one call ----
  {
    const r = await adapter.pushRatesAndRestrictions([
      u(TWIN_BAR, "2026-11-21", { priceMinor: 12500 }),
      u(DOUBLE_BAR, "2026-11-25", { priceMinor: 13500 }),
      u(DOUBLE_BF, "2026-11-29", { priceMinor: 15500 }),
    ]);
    record("3 · Single date, multiple rates (3 changes, 1 call)", [r.taskId], "batched");
  }

  // ---- Test 4: Multiple date ranges, multiple rates — one call ----
  {
    const updates = [
      ...dateRange("2026-11-01", "2026-11-10").map((d) => u(TWIN_BAR, d, { priceMinor: 11800 })),
      ...dateRange("2026-11-10", "2026-11-16").map((d) => u(DOUBLE_BAR, d, { priceMinor: 12900 })),
      ...dateRange("2026-11-01", "2026-11-20").map((d) => u(DOUBLE_BF, d, { priceMinor: 14900 })),
    ];
    const r = await adapter.pushRatesAndRestrictions(updates);
    record("4 · Multi-date, multi-rate ranges (1 call)", [r.taskId], `${updates.length} rate-days`);
  }

  // ---- Test 5: Min stay — 3 rate/date combos, one call ----
  {
    const r = await adapter.pushRatesAndRestrictions([
      u(TWIN_BAR, "2026-11-23", { priceMinor: 12000, restrictions: { minLos: 3, stopSell: false, cta: false, ctd: false } }),
      u(DOUBLE_BAR, "2026-11-25", { priceMinor: 13000, restrictions: { minLos: 2, stopSell: false, cta: false, ctd: false } }),
      u(DOUBLE_BF, "2026-11-15", { priceMinor: 15000, restrictions: { minLos: 5, stopSell: false, cta: false, ctd: false } }),
    ]);
    record("5 · Min-stay update (3 combos, 1 call)", [r.taskId], "min 3/2/5 nights");
  }

  // ---- Test 6: Stop sell — 3 rate/date pairs, one call ----
  {
    const r = await adapter.pushRatesAndRestrictions([
      u(TWIN_BAR, "2026-11-14", { priceMinor: 12000, restrictions: { stopSell: true, cta: false, ctd: false } }),
      u(DOUBLE_BAR, "2026-11-16", { priceMinor: 13000, restrictions: { stopSell: true, cta: false, ctd: false } }),
      u(DOUBLE_BF, "2026-11-20", { priceMinor: 15000, restrictions: { stopSell: true, cta: false, ctd: false } }),
    ]);
    record("6 · Stop-sell update (3 pairs, 1 call)", [r.taskId], "closed");
  }

  // ---- Test 7: Multiple restrictions — CTA/CTD/min/max across 4 ranges, one call ----
  {
    const updates = [
      ...dateRange("2026-12-01", "2026-12-05").map((d) => u(TWIN_BAR, d, { priceMinor: 12000, restrictions: { cta: true, stopSell: false, ctd: false } })),
      ...dateRange("2026-12-06", "2026-12-10").map((d) => u(DOUBLE_BAR, d, { priceMinor: 13000, restrictions: { ctd: true, stopSell: false, cta: false } })),
      ...dateRange("2026-12-11", "2026-12-15").map((d) => u(DOUBLE_BF, d, { priceMinor: 15000, restrictions: { minLos: 2, stopSell: false, cta: false, ctd: false } })),
      ...dateRange("2026-12-16", "2026-12-20").map((d) => u(TWIN_BF, d, { priceMinor: 14000, restrictions: { maxLos: 7, stopSell: false, cta: false, ctd: false } })),
    ];
    const r = await adapter.pushRatesAndRestrictions(updates);
    record("7 · Multiple restrictions (CTA/CTD/min/max, 1 call)", [r.taskId], `${updates.length} rate-days`);
  }

  // ---- Test 8: Half-year update — Dec 2026 → May 2027, both rooms, one call ----
  {
    const updates = [
      ...dateRange("2026-12-01", "2027-05-31").map((d) => u(DOUBLE_BAR, d, { priceMinor: 12500, restrictions: { minLos: 1, stopSell: false, cta: false, ctd: false } })),
      ...dateRange("2026-12-01", "2027-05-31").map((d) => u(TWIN_BAR, d, { priceMinor: 11500, restrictions: { minLos: 1, stopSell: false, cta: false, ctd: false } })),
    ];
    const r = await adapter.pushRatesAndRestrictions(updates);
    record("8 · Half-year update (Dec 26 → May 27, 1 call)", [r.taskId], `${updates.length} rate-days`);
  }

  // ---- Test 9: Single date availability — Twin 8→7 (21 Nov), Double 1→0 (25 Nov) ----
  {
    const r = await adapter.pushAvailability([
      u(TWIN_BAR, "2026-11-21", { bookable: 7 }),
      u(DOUBLE_BAR, "2026-11-25", { bookable: 0 }),
    ]);
    record("9 · Single-date availability (Twin 8→7, Double 1→0)", [r.taskId], "1 availability call");
  }

  // ---- Test 10: Multiple date availability ranges — one call ----
  {
    const updates = [
      ...dateRange("2026-11-10", "2026-11-16").map((d) => u(TWIN_BAR, d, { bookable: 3 })),
      ...dateRange("2026-11-17", "2026-11-24").map((d) => u(DOUBLE_BAR, d, { bookable: 4 })),
    ];
    const r = await adapter.pushAvailability(updates);
    record("10 · Multi-date availability ranges (1 call)", [r.taskId], `${updates.length} room-days`);
  }

  // ---- Summary ----
  console.log("\n══════ CERTIFICATION TASK IDS (paste into the form) ══════");
  for (const r of results) {
    console.log(`\n${r.test}  [${r.note}]`);
    if (r.taskIds.length) r.taskIds.forEach((id) => console.log(`   task_id: ${id}`));
    else console.log("   ✗ no task id — check the error above");
  }
  console.log("\nVerify processing at: staging.channex.io → any task id → GET /api/v1/tasks/{id}");
}

function record(test: string, ids: (string | undefined)[], note: string) {
  const taskIds = ids.filter((id): id is string => !!id);
  results.push({ test, taskIds, note });
  console.log(`✓ Test ${test}  →  ${taskIds.length ? taskIds.join(", ") : "(no task id)"}`);
}

main().catch((err) => {
  console.error("Cert run failed:", err);
  process.exit(1);
});
