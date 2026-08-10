/**
 * Judge a Channex task id against the certification spec — BEFORE it goes in the form.
 *
 *   pnpm --filter @revio/connectivity channex:cert-verify <results.json>
 *
 * The first submission failed 8 of 12 because the only check applied was "did Channex return
 * success". It does: `success: true` means the payload was well-formed and accepted, not that it
 * said what the test asked for. Every one of those eight failures is visible in the task's own
 * stored payload, which is what this reads (`GET /tasks/{id}` → `attributes.payload.values`).
 *
 * results.json maps a test number to the task ids that ONE user action in RevioLink produced:
 *
 *   {
 *     "1":  { "availability": "<task id>", "rates": "<task id>" },
 *     "2":  ["<task id>"],
 *     "9":  ["<task id>"]
 *   }
 *
 * Exit code is non-zero if any test fails, so this can gate a submission rather than advise one.
 */

import { CHANNEX_STAGING_URL } from "../src/channex-channel-adapter.js";
import { CERT_TESTS, verifyTest, rowDays, type WireRow, type Expectation } from "../src/cert-expectations.js";
import { readFileSync } from "node:fs";

const env = process.env;
const apiKey = env.CHANNEX_API_KEY!;
const baseUrl = env.CHANNEX_BASE_URL ?? CHANNEX_STAGING_URL;

/** Spec label → sandbox UUID. Kept in env because the cert docs call hardcoded UUIDs an anti-pattern. */
const PRODUCT_IDS: Record<Expectation["product"], string> = {
  "twin-bar": env.CHANNEX_TWIN_BAR_ID!,
  "twin-bnb": env.CHANNEX_TWIN_BREAKFAST_ID!,
  "double-bar": env.CHANNEX_DOUBLE_BAR_ID!,
  "double-bnb": env.CHANNEX_DOUBLE_BREAKFAST_ID!,
  "twin-room": env.CHANNEX_TWIN_ROOM_ID!,
  "double-room": env.CHANNEX_DOUBLE_ROOM_ID!,
};

interface Task {
  id: string;
  success: boolean;
  errors: unknown[];
  rows: WireRow[];
}

async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${baseUrl}/tasks/${id}`, {
    headers: { "user-api-key": apiKey, Accept: "application/json" },
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: { attributes?: { success?: boolean; errors?: unknown[]; payload?: { values?: WireRow[] } } } }
    | null;
  if (!res.ok || !body?.data) throw new Error(`task ${id}: HTTP ${res.status}`);
  const a = body.data.attributes ?? {};
  return { id, success: a.success ?? false, errors: a.errors ?? [], rows: a.payload?.values ?? [] };
}

const GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", DIM = "\x1b[2m", OFF = "\x1b[0m";

/**
 * Test 1 is not in CERT_TESTS: it prescribes no values, only shape — 500 days of everything, for
 * every room and rate, in at most one call per endpoint, with data that VARIES. "Not every room at 1
 * and $100" is a literal requirement, so a uniform payload is checked for and reported.
 */
function verifyFullSync(kind: "availability" | "rates", task: Task): string[] {
  const problems: string[] = [];
  const days = new Set<string>();
  const products = new Set<string>();
  const values = new Set<number | undefined>();
  for (const r of task.rows) {
    for (const d of rowDays(r)) days.add(d);
    const id = kind === "availability" ? r.room_type_id : r.rate_plan_id;
    if (id) products.add(id);
    values.add(kind === "availability" ? r.availability : r.rate);
  }
  const wantProducts = kind === "availability" ? 2 : 4;
  if (days.size < 500) problems.push(`covers ${days.size} days, the full sync must cover 500`);
  if (products.size !== wantProducts) {
    problems.push(`covers ${products.size} ${kind === "availability" ? "room types" : "rate plans"}, expected ${wantProducts}`);
  }
  if (values.size < 2) problems.push(`every ${kind === "availability" ? "count" : "rate"} is identical — the data must be varied, not uniform`);
  return problems;
}

async function main() {
  const path = process.argv[2];
  if (!apiKey || !path) {
    console.log("usage: channex:cert-verify <results.json>   (needs CHANNEX_* in .env.local)");
    process.exit(1);
  }
  for (const [label, id] of Object.entries(PRODUCT_IDS)) {
    if (!id) {
      console.log(`${RED}Missing product id for ${label} — set the CHANNEX_* vars in .env.local.${OFF}`);
      process.exit(1);
    }
  }

  const results = JSON.parse(readFileSync(path, "utf8")) as Record<string, string[] | Record<string, string>>;
  let failed = 0;
  let checked = 0;

  for (const spec of [{ id: 1, title: "Full Data Update (Full Sync)" }, ...CERT_TESTS]) {
    const entry = results[String(spec.id)];
    if (!entry) {
      console.log(`${DIM}Test ${spec.id} — ${spec.title}: no task id supplied, skipped${OFF}`);
      continue;
    }
    checked++;

    const ids = Array.isArray(entry) ? entry : Object.values(entry);
    let tasks: Task[];
    try {
      tasks = await Promise.all(ids.map(fetchTask));
    } catch (err) {
      failed++;
      console.log(`${RED}✗ Test ${spec.id} — ${spec.title}${OFF}\n    ${(err as Error).message}`);
      continue;
    }

    const problems: string[] = [];
    for (const t of tasks) {
      if (!t.success) problems.push(`task ${t.id} did not succeed: ${JSON.stringify(t.errors)}`);
    }

    if (spec.id === 1) {
      const labelled = Array.isArray(entry) ? null : (entry as Record<string, string>);
      if (!labelled?.availability || !labelled?.rates) {
        problems.push(`test 1 needs both ids, labelled: {"availability": "…", "rates": "…"}`);
      } else {
        const byId = new Map(tasks.map((t) => [t.id, t]));
        problems.push(...verifyFullSync("availability", byId.get(labelled.availability)!));
        problems.push(...verifyFullSync("rates", byId.get(labelled.rates)!));
      }
    } else {
      const full = CERT_TESTS.find((t) => t.id === spec.id)!;
      const rows = tasks.flatMap((t) => t.rows);
      const verdict = verifyTest(full, rows, tasks.length, PRODUCT_IDS);
      problems.push(...verdict.problems);
      for (const w of verdict.warnings) console.log(`  ${YELLOW}! ${w}${OFF}`);
    }

    if (problems.length === 0) {
      console.log(`${GREEN}✓ Test ${spec.id} — ${spec.title}${OFF}  ${DIM}${ids.join(" · ")}${OFF}`);
    } else {
      failed++;
      console.log(`${RED}✗ Test ${spec.id} — ${spec.title}${OFF}  ${DIM}${ids.join(" · ")}${OFF}`);
      for (const p of problems) console.log(`    ${RED}·${OFF} ${p}`);
    }
  }

  console.log();
  if (failed > 0) {
    console.log(`${RED}${failed} of ${checked} checked tests would fail certification. Do NOT submit these ids.${OFF}`);
    process.exit(1);
  }
  console.log(`${GREEN}All ${checked} checked tests match the spec.${OFF}`);
}

main().catch((err) => {
  console.error("cert-verify failed:", err.message ?? err);
  process.exit(1);
});
