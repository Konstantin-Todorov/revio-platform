#!/usr/bin/env node
/**
 * Every server action that writes twice must either write inside ONE transaction, or say why not.
 *
 * ## Why
 *
 * `forTenant()` / `forSystem()` wrap every single Prisma call in its own transaction (the RLS
 * setting is transaction-local — `packages/db/src/rls.ts`). So an action that does
 *
 *     await prisma.reservation.update(...)
 *     await prisma.folio.create(...)
 *
 * is TWO transactions, and a failure between them leaves the first committed. That is how a PMS
 * checkout once closed a folio and left its guest in-house, accruing nightly charges for 41 nights.
 * `withTenantTransaction` / `withSystemTransaction` make it one; `folio-atomic-verify` proves they
 * are atomic. Nothing proved the callers USE them — this does (HANDOFF-2026-09-22 §2, §10.1).
 *
 * ## The rule
 *
 * In `apps/*\/lib/actions-*.ts`, an exported async function with two or more awaited model writes
 * (create / createMany / update / updateMany / upsert / delete / deleteMany) OUTSIDE a
 * `with{Tenant,System}Transaction(...)` callback is a finding. Each finding is either fixed or listed
 * in EXEMPT below with the reason its writes may commit separately — "the second write is a log
 * line", "each write is a whole, independent outcome". A reason is a sentence about THIS action.
 *
 * ## What it cannot see
 *
 * Writes inside a helper the action calls are not counted: `await releaseRooms(...)` is one line
 * here. Helpers in `@revio/db` that need atomicity own their transaction; this lint is about the
 * action layer, where the partial commits have actually happened.
 *
 * Run: node scripts/atomic-lint.mjs [--list]   (part of `pnpm verify`)
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";

const APPS = ["reservation", "channel-manager", "pms", "operator", "booking"];
const WRITE = /\b(\w+)\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

/** `file#function` → why its writes may commit one at a time. Keep each reason about that action. */
const EXEMPT = new Map([
  ["apps/channel-manager/lib/actions-config.ts#fixMappings",
    "Mock channels only. Each mapping row is a whole, idempotent fill of a blank id; pressing Auto-fix again completes whatever an interrupted run left, and errorCount is a display counter."],
  ["apps/channel-manager/lib/actions-config.ts#updateStreamMapping",
    "if/else: the room mapping is written in one branch, the rate mapping in the other — one write at runtime."],
  ["apps/channel-manager/lib/actions-connect.ts#provisionChannex",
    "Writes as it goes ON PURPOSE: each mapping records an object just created at Channex. A rollback would forget objects that exist remotely; committing each one is what lets a run that stopped part-way be resumed rather than duplicated."],
  ["apps/channel-manager/lib/actions-connect.ts#syncChannexStructure",
    "Same as provisionChannex: each upsert records a room type or rate plan just created at Channex, and must survive a later failure so the next run does not create it twice."],
  ["apps/channel-manager/lib/actions-connect.ts#sendProductToChannex",
    "Same as provisionChannex: the mapping records the remote object the moment Channex returns its id."],
  ["apps/channel-manager/lib/actions-notifications.ts#markNotificationRead",
    "The second write only trims the read-keys list to its bound. Losing it costs one already-seen line showing bold again (see the comment in the action)."],
  ["apps/operator/lib/actions-notifications.ts#markNotificationRead",
    "The second write only trims the read-keys list to its bound. Losing it costs one already-seen line showing bold again."],
  ["apps/pms/lib/actions-notifications.ts#markNotificationRead",
    "The second write only trims the read-keys list to its bound. Losing it costs one already-seen line showing bold again."],
  ["apps/reservation/lib/actions-notifications.ts#markNotificationRead",
    "The second write only trims the read-keys list to its bound. Losing it costs one already-seen line showing bold again."],
  ["apps/pms/lib/actions-maintenance.ts#setMaintenanceStatus",
    "Retry-safe: `setsOoo` stays true until the room is back on sale, so pressing Done again finishes an interrupted run. The room is returned by clearUnitOoo, which also pushes to channels and so cannot sit inside a database transaction."],
  ["apps/pms/lib/actions-roomtypes.ts#removeRoomType",
    "if/else: deactivate in one branch, delete in the other — one write at runtime."],
  ["apps/reservation/lib/actions-rates.ts#deleteRatePlan",
    "if/else: deactivate in one branch, delete in the other — one write at runtime."],
  ["apps/reservation/lib/actions-rates.ts#deleteRoomType",
    "if/else: deactivate in one branch, delete in the other — one write at runtime."],
  ["apps/reservation/lib/actions-rates.ts#saveRatePlanLinkage",
    "The two updates are the unlink branch (which returns) and the link branch — one write at runtime."],
  ["apps/reservation/lib/actions-booking-engine.ts#saveBookingEngineLink",
    "The two updates are the already-published branch (which returns) and the first-publish branch — one write at runtime."],
  ["apps/reservation/lib/actions-rates.ts#applyCrsBulkUpdateMulti",
    "Each write is an idempotent 'set this cell to X', so repeating the same bulk edit completes an interrupted one. One transaction over a whole calendar of cells would hold row locks across every date for the length of the run and exceed any sane timeout."],
  ["apps/reservation/lib/actions-settings.ts#setCmConnection",
    "The second write is a Sync Center log line about the first; the state change stands on its own."],
]);

/** Remove the arguments of every `with…Transaction(` call — the writes inside are one transaction. */
function stripTransactions(src) {
  let out = "";
  let i = 0;
  const re = /with(Tenant|System)Transaction\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    out += src.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < src.length && depth > 0; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") depth--;
    }
    out += "withTransaction(/* one transaction */)";
    i = j;
    re.lastIndex = j;
  }
  return out + src.slice(i);
}

/** Exported async functions with their bodies, by brace matching from the signature. */
function* actions(src) {
  const re = /^export async function (\w+)[^{]*\{/gm;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < src.length && depth > 0; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
    }
    yield { name: m[1], line: src.slice(0, m.index).split("\n").length, body: src.slice(m.index, j) };
  }
}

const findings = [];
let scanned = 0;
for (const app of APPS) {
  const dir = `apps/${app}/lib`;
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => /^actions-.*\.ts$/.test(f))) {
    const path = `${dir}/${file}`;
    const src = readFileSync(path, "utf8");
    for (const a of actions(src)) {
      scanned++;
      // Comments describe writes; they do not perform them.
      const code = stripTransactions(a.body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""));
      const all = [...code.matchAll(WRITE)]
        .filter((w) => w[1] !== "tx" && w[1] !== "t") // a transaction client's writes are inside one
        .map((w) => `${w[2]}.${w[3]}`);
      /*
       * `if (id) model.update(...) else model.create(...)` is ONE write at runtime, whichever branch
       * runs. A regex cannot see branches, so an update and a create of the same model count once —
       * the commonest false positive by far ("save" actions that edit or add). Anything else on the
       * same model (two updates, an update then a delete) still counts, because those are sequential.
       */
      const writes = [];
      const pending = new Map();
      for (const w of all) {
        const [model, op] = w.split(".");
        const pair = op === "create" ? (pending.get(`${model}.update`) ? "update" : "updateMany") : op === "update" || op === "updateMany" ? "create" : null;
        if (pair && (pending.get(`${model}.${pair}`) ?? 0) > 0) {
          pending.set(`${model}.${pair}`, pending.get(`${model}.${pair}`) - 1);
          writes[writes.findIndex((x) => x === `${model}.${pair}`)] = `${model}.${pair}|${op}`;
          continue;
        }
        pending.set(w, (pending.get(w) ?? 0) + 1);
        writes.push(w);
      }
      if (writes.length >= 2) findings.push({ key: `${path}#${a.name}`, at: `${path}:${a.line}`, writes });
    }
  }
}

const open = findings.filter((f) => !EXEMPT.has(f.key));
const stale = [...EXEMPT.keys()].filter((k) => !findings.some((f) => f.key === k));

if (process.argv.includes("--list")) {
  for (const f of findings) console.log(`${EXEMPT.has(f.key) ? "exempt" : "OPEN  "} ${f.at}  ${f.key.split("#")[1]}  [${f.writes.join(", ")}]`);
}

if (stale.length) {
  console.error(`\natomic-lint: ${stale.length} exemption(s) for actions that no longer write twice — remove them:\n  ${stale.join("\n  ")}\n`);
  process.exit(1);
}
if (open.length) {
  console.error(`\natomic-lint: ${open.length} server action(s) write two or more times outside one transaction:\n`);
  for (const f of open) console.error(`  ${f.at}  ${f.key.split("#")[1]}  [${f.writes.join(", ")}]`);
  console.error(
    "\nWrap the writes that must land together in withTenantTransaction (or withSystemTransaction), " +
      "or add the action to EXEMPT in scripts/atomic-lint.mjs with the reason its writes may commit separately.\n",
  );
  process.exit(1);
}
console.log(`atomic-lint: ${scanned} server actions · ${findings.length} write more than once outside a transaction, each with a stated reason.`);
