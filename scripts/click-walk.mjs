/**
 * Drive the things a person CLICKS, in a real browser.
 *
 * ## Why this exists, on top of `route-walk`
 *
 * `route-walk` opens every screen and proves none of them is a failure screen. It cannot press
 * anything, and **three of the four bugs found on 2026-09-14 needed a press**:
 *
 *  - clicking a notification called a server action that used `prisma.$executeRaw` — which does not
 *    exist on the RLS proxy, because that proxy deliberately exposes model operations only;
 *  - "mark all read" left one item unread forever, so the badge never reached zero and pressing the
 *    button again did nothing;
 *  - a generic signature dropped the `read` flag, so every row would have rendered as already read.
 *
 * Every one of those passed 2,591 unit tests and every lint. They are not exotic: they are what
 * happens between a click and a database, which is the part nothing here was looking at.
 *
 * ## What it checks, and what makes a check here honest
 *
 * The bar is the same as `route-walk`'s: **the absence of an error is not success.** Each flow
 * asserts something POSITIVE happened — the palette actually opened a booking, the unread count
 * actually fell, the mark survived a reload — and separately that nothing threw. A flow that only
 * asserts "no error" passes just as well when the button does nothing at all.
 *
 * Console errors are collected throughout. `Application error: a client-side exception` is the exact
 * text the founder was shown, and it is a failure here wherever it appears.
 *
 * ## Running it
 *
 *     pnpm click-walk                 # every app that is running
 *     pnpm click-walk --app pms
 *
 * Start the app first. An app that is not listening is reported as SKIPPED, never as passing.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = {
  "channel-manager": { port: 3000, cookie: "revio_session", label: "RevioLink", home: "/dashboard", query: "deluxe" },
  reservation: { port: 3002, cookie: "revio_crs_session", label: "RevioCRS", home: "/dashboard", query: "deluxe" },
  pms: { port: 3003, cookie: "revio_pms_session", label: "RevioPMS", home: "/dashboard", query: "deluxe" },
  operator: { port: 3001, cookie: "revio_op_session", label: "Operator", home: "/overview", query: "sofia", operator: true },
};

function psql(sql) {
  try {
    return execFileSync("psql", ["-d", process.env.WALK_DB ?? "revio_dev", "-tAc", sql], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return ""; }
}

async function mintSession(app, sub, kind) {
  const file = join(ROOT, "apps", app, ".env.local");
  if (!existsSync(file)) return null;
  const m = /^AUTH_SECRET=(.*)$/m.exec(readFileSync(file, "utf8"));
  if (!m) return null;
  // jose is resolved from the APP — pnpm does not hoist it to the root.
  const require = createRequire(join(ROOT, "apps", app, "package.json"));
  const { SignJWT } = require("jose");
  return new SignJWT({ kind, sub })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 1800)
    .sign(new TextEncoder().encode(m[1].trim().replace(/^["']|["']$/g, "")));
}

async function alive(port) {
  try {
    const r = await fetch(`http://localhost:${port}/login`, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return r.status < 500;
  } catch { return false; }
}

/** The bell's accessible name carries the count, so the unread total is readable without guessing. */
const unreadFrom = (label) => {
  const m = /(\d+)\s+unread/.exec(label ?? "");
  return m ? Number(m[1]) : 0;
};


/**
 * One unread notification, made on purpose and taken away again.
 *
 * ⚠️ **Without this the harness exercises nothing.** The seeded demo data is weeks old, so every
 * product's feed is legitimately empty and the mark-read paths — the exact paths that broke on
 * 2026-09-14 — are never pressed. A run that reports "nothing to exercise" for the thing it was
 * written to test is a run that passes without testing.
 *
 * For a hotel product it moves ONE existing reservation's `importedAt` to now, which is what the
 * feed reads as "a booking arrived", and puts the old value back afterwards. For the operator
 * console it inserts a demo request and deletes it. Both are reversed in a `finally`, so a crash
 * mid-walk still leaves the database as it found it.
 *
 * ⚠️ It refuses to touch anything but a local database. This writes, and a harness that writes must
 * never be one connection string away from doing it to a customer.
 */
function assertLocalDatabase() {
  const db = process.env.WALK_DB ?? "revio_dev";
  if (/@|:\/\//.test(db) || db !== "revio_dev") {
    console.error(`click-walk refuses to run against "${db}" — it writes a fixture row, so it only ever runs on the local revio_dev database.`);
    process.exit(1);
  }
}

const FIXTURE_ID = "clickwalk0000000000000001";

function makeUnread(cfg, ownerId) {
  /* ⚠️ Clear THIS account's read state for the duration, and put it back afterwards.
     A previous run's "mark all read" leaves a marker that covers everything older, so a second run
     finds its own fresh fixture already read and reports the feed as broken. A harness whose result
     depends on whether it has been run before is not a harness. */
  const table = cfg.operator ? "OperatorUser" : "User";
  const prior = psql(`select coalesce("notificationsClearedAt"::text, '') || '|' || array_to_string("notificationsReadKeys", ',') from "${table}" where id = '${ownerId}'`);
  psql(`update "${table}" set "notificationsClearedAt" = null, "notificationsReadKeys" = '{}' where id = '${ownerId}'`);
  const readState = { table, ownerId, prior };

  if (cfg.operator) {
    // ⚠️ TWO, for the same reason the hotel fixture bumps two reservations: marking the only unread
    // item read leaves no "Mark all read" button, and that path goes silently unexercised.
    for (const n of [1, 2]) {
      psql(`insert into "Lead" (id, name, email, message, "createdAt")
            values ('${FIXTURE_ID}${n}', 'click-walk fixture ${n}', 'fixture${n}@example.invalid', 'temporary row created by pnpm click-walk', (now() at time zone 'UTC'))
            on conflict (id) do nothing`);
    }
    return { kind: "lead", marker: "click-walk fixture 1", readState };
  }
  /* ⚠️ TWO events, not one. Marking the single event read leaves nothing unread, the "Mark all
     read" button stops rendering, and that path — where the clock-skew bug lived — is silently
     never pressed. The run still reported success, which is the failure mode this whole file is
     about. */
  const rows = psql(`select r.id || '|' || r."importedAt" || '|' || coalesce(r."guestName", '') from "Reservation" r
                     join "Property" p on p.id = r."propertyId"
                     where p."tenantId" = (select "tenantId" from "User" where id = '${ownerId}')
                     order by r."importedAt" desc limit 2`).split("\n").filter(Boolean);
  if (rows.length === 0) return { kind: "none", readState };
  const saved = rows.map((r) => { const [id, importedAt, guestName] = r.split("|"); return { id, importedAt, guestName }; });
  /* ⚠️ `now() at time zone 'UTC'`, never bare `now()`. These columns are naive timestamps that the
     application reads as UTC, while psql's session runs in Europe/Sofia — so a bare now() lands
     three hours in the FUTURE. Yesterday that made a test row un-markable-as-read and sent me
     hunting a bug that was the fixture's. */
  for (const r of saved) psql(`update "Reservation" set "importedAt" = (now() at time zone 'UTC') where id = '${r.id}'`);
  // The title the feed renders for the first one, so the click below targets THIS event rather than
  // whatever happens to be first in the panel.
  return { kind: "reservation", saved, marker: saved[0].guestName || "Reservation", readState };
}

function undoUnread(fixture) {
  if (!fixture) return;
  if (fixture.kind === "lead") psql(`delete from "Lead" where id like '${FIXTURE_ID}%'`);
  else if (fixture.kind === "reservation") {
    for (const r of fixture.saved) psql(`update "Reservation" set "importedAt" = '${r.importedAt}' where id = '${r.id}'`);
  }
  const rs = fixture.readState;
  if (rs) {
    const [clearedAt, keys] = (rs.prior ?? "|").split("|");
    const keyList = keys ? `'{${keys}}'` : `'{}'`;
    psql(`update "${rs.table}" set "notificationsClearedAt" = ${clearedAt ? `'${clearedAt}'` : "null"}, "notificationsReadKeys" = ${keyList} where id = '${rs.ownerId}'`);
  }
}

async function run(app, cfg, page, out, fixture) {
  const fails = [];
  const note = (s) => out.push(`      ${s}`);

  // ---- ⌘K: type, and open what it finds -------------------------------------------------------
  /* ⚠️ Wait for HYDRATION, not for the network.
     `waitUntil: "networkidle"` never fires on these pages — the notification centre polls every 60
     seconds, so the network is never idle and the walk hangs forever. And without waiting at all,
     ⌘K is pressed before React has attached its listener and the palette simply never opens, which
     looks exactly like a broken feature. The bell being visible is the hydration signal. */
  await page.goto(`http://localhost:${cfg.port}${cfg.home}`, { waitUntil: "domcontentloaded" });
  await page.locator('button[aria-label^="Notifications"]').first().waitFor({ state: "visible", timeout: 25000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Control+k");
  const input = page.locator('div[role="dialog"] input');
  if (await input.count() === 0) {
    fails.push("⌘K did not open the palette");
  } else {
    await input.fill(cfg.query);
    // The rows are what the ranking produced — waiting for one is waiting for the search to answer.
    const row = page.locator('div[role="dialog"] button[data-active]').first();
    try {
      await row.waitFor({ state: "visible", timeout: 15000 });
      const title = (await row.innerText()).split("\n")[0];
      const before = page.url();
      await row.click();
      await page.waitForURL((u) => u.toString() !== before, { timeout: 15000 });
      const body = await page.locator("body").innerText();
      // ⚠️ The positive assertion. "No error" also passes when the click does nothing, and the
      // founder's bug was precisely a click that led somewhere useless rather than one that threw.
      if (/We couldn.{1,3}t find that/i.test(body)) {
        fails.push(`palette opened "${title}" and landed on a not-found screen`);
      } else {
        note(`⌘K → "${title}" → ${new URL(page.url()).pathname} ✓`);
      }
    } catch {
      fails.push(`⌘K found nothing for "${cfg.query}" — the palette answered with no rows`);
    }
  }

  // ---- The notification centre: read one, then read them all ----------------------------------
  await page.goto(`http://localhost:${cfg.port}${cfg.home}`, { waitUntil: "domcontentloaded" });
  const bell = page.locator('button[aria-label^="Notifications"]').first();
  if (await bell.count() === 0) {
    fails.push("no notification bell in the topbar");
    return fails;
  }
  await bell.waitFor({ state: "visible", timeout: 25000 });
  await page.waitForTimeout(1200);
  const startUnread = unreadFrom(await bell.getAttribute("aria-label"));
  await bell.click();
  await page.waitForTimeout(700);
  // The component sets aria-expanded itself, so this asks the component rather than guessing at a
  // class name that a restyle would quietly break.
  if ((await bell.getAttribute("aria-expanded")) !== "true") fails.push("the notification panel did not open");

  if (startUnread === 0) {
    // The fixture should have guaranteed one. If there is still nothing, the feed is not reading
    // what we just wrote — which is itself worth failing on rather than shrugging past.
    fails.push("nothing unread even after creating a fixture event — the feed is not picking it up");
  } else {
    /* Mark ONE read by opening it, then come back and check the count actually fell.
       ⚠️ Target the FIXTURE's own row, not "the first button in the panel". The panel leads with
       "Needs attention" — derived state that deliberately has no read mark — so clicking the first
       row navigated somewhere useful and marked nothing, and the harness reported a persistence bug
       that was its own. Naming the row also makes the assertion about a specific event. */
    const first = page.getByRole("button", { name: new RegExp(fixture?.marker ?? "New booking", "i") }).first();
    if (await first.count() > 0) {
      await first.click();
      await page.waitForTimeout(1500);
      await page.goto(`http://localhost:${cfg.port}${cfg.home}`, { waitUntil: "domcontentloaded" });
      const after = unreadFrom(await page.locator('button[aria-label^="Notifications"]').first().getAttribute("aria-label"));
      /* ⚠️ Asserted across a RELOAD, deliberately. The optimistic update makes the badge fall on the
         client whatever the server did — which is exactly how a write that threw
         (`$executeRaw is not a function`) still looked like it had worked. */
      if (after >= startUnread) fails.push(`marking one read did not persist (${startUnread} → ${after} after reload)`);
      else note(`notifications: one read persisted (${startUnread} → ${after}) ✓`);
    }

    // Now clear the rest and insist the badge reaches zero.
    // ⚠️ Hydrate again after the reload. Clicking the bell before React attaches does nothing, the
    // panel never opens, and the "Mark all read" button is reported missing — a harness bug that
    // reads exactly like a product bug.
    const bell2 = page.locator('button[aria-label^="Notifications"]').first();
    await bell2.waitFor({ state: "visible", timeout: 25000 });
    await page.waitForTimeout(1200);
    await bell2.click();
    await page.waitForTimeout(700);
    const markAll = page.getByRole("button", { name: "Mark all read" });
    if (await markAll.count() === 0) {
      // Not "nothing to do" — the fixture guarantees something unread, so a missing button means
      // the path went unexercised and the run must not claim otherwise.
      fails.push('"Mark all read" was never pressed — no such button while something was unread');
    } else {
      await markAll.click();
      await page.waitForTimeout(2500);
      await page.goto(`http://localhost:${cfg.port}${cfg.home}`, { waitUntil: "domcontentloaded" });
      const cleared = unreadFrom(await page.locator('button[aria-label^="Notifications"]').first().getAttribute("aria-label"));
      /* ⚠️ Zero, not "fewer". An event stamped ahead of the server clock used to survive "mark all
         read" forever, so the badge never reached zero and pressing again changed nothing. */
      if (cleared !== 0) fails.push(`"mark all read" left ${cleared} unread — the badge cannot be cleared`);
      else note(`notifications: "mark all read" cleared the badge ✓`);
    }
  }
  return fails;
}

const only = process.argv.includes("--app") ? process.argv[process.argv.indexOf("--app") + 1] : null;
const out = [];
const skipped = [];
let anyFailure = false, anyRan = false;

assertLocalDatabase();
const browser = await chromium.launch({ headless: true });
try {
  for (const [app, cfg] of Object.entries(APPS)) {
    if (only && only !== app) continue;
    if (!(await alive(cfg.port))) { skipped.push(cfg.label); out.push(`  ${cfg.label.padEnd(11)} SKIPPED — nothing listening on :${cfg.port}`); continue; }

    const who = cfg.operator
      ? psql(`select id from "OperatorUser" where active = true limit 1`)
      : psql(`select u.id from "User" u where u.role = 'owner'
              order by (select count(*) from "Reservation" r join "Property" p on p.id = r."propertyId"
                        where p."tenantId" = u."tenantId") desc limit 1`);
    const token = who ? await mintSession(app, who, cfg.operator ? "operator" : "hotel") : null;
    if (!token) { skipped.push(cfg.label); out.push(`  ${cfg.label.padEnd(11)} SKIPPED — no seeded account or AUTH_SECRET`); continue; }

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: cfg.cookie, value: token, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();

    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => consoleErrors.push(`uncaught: ${String(e.message).slice(0, 160)}`));

    anyRan = true;
    let fails = [];
    let fixture = null;
    try {
      fixture = makeUnread(cfg, who);
      fails = await run(app, cfg, page, out, fixture);
    } catch (e) {
      fails.push(`the walk itself threw: ${e.message.split("\n")[0]}`);
    } finally {
      // Always, even on a crash — a harness that leaves its fixtures behind poisons the next run.
      undoUnread(fixture);
    }

    // The founder's exact symptom, wherever it shows up.
    const fatal = consoleErrors.filter((t) => /Application error|client-side exception/i.test(t));
    if (fatal.length) fails.push(`client-side exception: ${fatal[0]}`);

    if (fails.length) {
      anyFailure = true;
      out.unshift(`  ${cfg.label.padEnd(11)} ${fails.length} broken:`);
      for (const f of fails) out.push(`      ✗ ${f}`);
    } else {
      out.unshift(`  ${cfg.label.padEnd(11)} click paths healthy`);
    }
    if (consoleErrors.length && !fatal.length) out.push(`      (${consoleErrors.length} console error(s), none fatal)`);

    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log("\nclick-walk — the things a person presses\n");
for (const line of out) console.log(line);

if (!anyRan) { console.log("\nNothing was walked. Start an app first.\n"); process.exit(1); }
if (anyFailure) {
  console.error(
    "\nclick-walk FAILED.\n" +
      "These are the paths that unit tests cannot see: what happens between a press and the\n" +
      "database. Every bug this was written for passed 2,591 tests and eleven lints.",
  );
  process.exit(1);
}
console.log(
  skipped.length
    ? `\nclick-walk: PARTIAL — ${skipped.length} app(s) not walked (${skipped.join(", ")}).\n`
    : "\nclick-walk: every click path exercised and none of them broke.\n",
);
