/**
 * Fire real hand-offs at the real routes and check what they do.
 *
 * ## Why this is a script and not a unit test
 *
 * A hand-off is a **session-granting credential in a URL** — the most dangerous shape a token takes
 * here. Its safety is not one function returning the right value; it is a chain: the route spends
 * the token, re-reads the account, asks `loginDestination`, and only then sets a cookie. A unit test
 * proves a link of that chain. This proves the chain, over HTTP, against the real database — which
 * is the same reason `webhook-verify` exists for the Stripe route.
 *
 * Four things it insists on, each a way the shape goes wrong:
 *
 *   1. **It works once** — a cookie comes back and the redirect lands inside the app.
 *   2. **It cannot be replayed** — the second attempt gets no cookie. Single use is the primary
 *      control; the 30-second expiry is only the backstop.
 *   3. **It is bound to its product** — a RevioPMS hand-off is *unrecognised* at RevioCRS, not
 *      "wrong product", because saying so would confirm the token exists.
 *   4. **Nonsense is refused** without a session.
 *
 * Removing `consumeToken` from the route makes line 2 go red with a cookie on the replay, which is
 * exactly the failure it is written to catch.
 *
 * Run (apps must be running locally):
 *
 *     DATABASE_URL=postgresql://localhost:5432/revio_dev DIRECT_DATABASE_URL=$DATABASE_URL \
 *     pnpm --filter @revio/db handoff-verify
 */
import { issueHandoff, forSystem } from "../src/index.js";

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error(`handoff-verify issues real credentials, so it only runs against a local database. DATABASE_URL="${url}"`);
  process.exit(1);
}

const PORT = { cm: 3000, crs: 3002, pms: 3003 } as const;

/*
 * ⚠️ Every app is probed BEFORE a single token is issued.
 *
 * This used to issue a hand-off and then call the app, so a product that was not running ended the
 * run in an unhandled `TypeError: fetch failed … ECONNREFUSED 127.0.0.1:3002` — forty lines of Node
 * internals that read like the hand-off itself had broken, with an orphaned token left behind in
 * the database. Found on 2026-09-22 by running it: the first attempt died on :3003, the second on
 * :3002, one missing app at a time.
 *
 * The other harnesses already refuse cleanly with exit 2 and the remedy — `webhook-verify` says
 * "nothing answering at … Start the console first". This now does the same, and names EVERY app
 * that is down in one go rather than making the person discover them serially.
 */
{
  const down: string[] = [];
  for (const [product, port] of Object.entries(PORT)) {
    const up = await fetch(`http://localhost:${port}/login`, { redirect: "manual", signal: AbortSignal.timeout(5000) })
      .then((r) => r.status < 500)
      .catch(() => false);
    if (!up) down.push(`${product} (:${port})`);
  }
  if (down.length > 0) {
    console.error(
      `REFUSING TO RUN: a hand-off crosses products, so all three must be running. Not answering: ${down.join(", ")}.\n` +
        "Start them first, e.g.  pnpm --filter @revio/reservation dev",
    );
    process.exit(2);
  }
}

const user = await forSystem().user.findFirst({
  where: { role: "owner", active: true },
  select: { id: true, email: true, tenant: { select: { hasPms: true, hasReservation: true } } },
});
if (!user) { console.error("No owner account in this database."); process.exit(1); }

async function hit(product: keyof typeof PORT, token: string) {
  const res = await fetch(`http://localhost:${PORT[product]}/handoff?t=${encodeURIComponent(token)}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const to = (res.headers.get("location") ?? "").replace(/^https?:\/\/[^/]+/, "");
  return { gotSession: /revio_(pms_|crs_)?session=/.test(setCookie) && !/revio_\w*session=;/.test(setCookie), to };
}

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

// 1 — it works once.
const t1 = await issueHandoff({ userId: user.id, email: user.email, product: "pms" });
const first = await hit("pms", t1);
check("a hand-off opens the product", first.gotSession && !first.to.startsWith("/login"), `cookie=${first.gotSession} → ${first.to || "(none)"}`);

// 2 — and only once.
const replay = await hit("pms", t1);
check("⚠️ a replay gets nothing", !replay.gotSession && replay.to.startsWith("/login"), `cookie=${replay.gotSession} → ${replay.to || "(none)"}`);

// 3 — bound to its product.
const t2 = await issueHandoff({ userId: user.id, email: user.email, product: "pms" });
const wrongApp = await hit("crs", t2);
check("⚠️ a PMS hand-off is not a CRS one", !wrongApp.gotSession && wrongApp.to.startsWith("/login"), `cookie=${wrongApp.gotSession} → ${wrongApp.to || "(none)"}`);

// 4 — nonsense.
const junk = await hit("pms", "not-a-token-at-all");
check("nonsense is refused", !junk.gotSession, `cookie=${junk.gotSession}`);

console.log("\nhandoff-verify\n");
for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}  —  ${r.detail}`);
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
await forSystem().$disconnect();
process.exit(failed.length === 0 ? 0 : 1);
