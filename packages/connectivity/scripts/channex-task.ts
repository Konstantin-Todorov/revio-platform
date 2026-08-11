/**
 * Print what a Channex task actually carried — the rows, not the "success".
 *
 *   pnpm --filter @revio/connectivity channex:task <task id> [<task id> ...]
 *
 * The sibling of `channex:cert-verify`: that one judges a task against the certification spec, this
 * one just shows you the payload when you want to read it yourself (a live-test rehearsal, a support
 * question, "why did that push send four rows").
 *
 * **Channex expires task records.** An id that resolved this morning returns `resource_not_found`
 * later the same day — including ids Channex has already certified. So inspect a push while it is
 * fresh; there is no going back for it afterwards. The durable record on our side is the SyncEvent,
 * which stores the window and the task id (Sync Center → Logs).
 */
import { CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";
const key = process.env.CHANNEX_API_KEY!;
const base = process.env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;
const NAME: Record<string,string> = {
  [process.env.CHANNEX_TWIN_ROOM_ID!]: "twin-room",
  [process.env.CHANNEX_DOUBLE_ROOM_ID!]: "double-room",
  [process.env.CHANNEX_TWIN_BAR_ID!]: "twin-bar",
  [process.env.CHANNEX_TWIN_BREAKFAST_ID!]: "twin-bnb",
  [process.env.CHANNEX_DOUBLE_BAR_ID!]: "double-bar",
  [process.env.CHANNEX_DOUBLE_BREAKFAST_ID!]: "double-bnb",
};
for (const id of process.argv.slice(2)) {
  const res = await fetch(`${base}/api/v1/tasks/${id}`, { headers: { "user-api-key": key } });
  const j = await res.json() as any;
  const rows = j?.data?.attributes?.payload?.values ?? [];
  console.log(`\n=== ${id} — ${rows.length} row(s) ===`);
  for (const r of rows) {
    const who = NAME[r.room_type_id ?? r.rate_plan_id] ?? (r.room_type_id ?? r.rate_plan_id);
    const when = r.date ?? `${r.date_from}..${r.date_to}`;
    const fields = Object.entries(r).filter(([k]) => !["room_type_id","rate_plan_id","date","date_from","date_to","property_id"].includes(k));
    console.log(`  ${who}  ${when}  ${fields.map(([k,v])=>`${k}=${v}`).join(" ")}`);
  }
}
