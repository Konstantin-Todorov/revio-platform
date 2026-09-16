/**
 * Walk every screen, signed in, and prove none of them broke.
 *
 * ## Why this exists
 *
 * On 2026-09-14 the founder opened a booking from the search bar in production and got a white page
 * reading *"Application error: a client-side exception has occurred."* Before that, a search result
 * led to "We couldn't find that" — the next screen denying what the search had just proved existed.
 *
 * At that moment the repository had **2,591 passing tests and eleven ratchet lints, and not one of
 * them opened a page.** Every test proved a function returned the right value; none proved a person
 * could load a screen. That is the gap this closes, and the founder named it: *"we need to have more
 * test for the system."*
 *
 * ## What it asserts, and why that is the right assertion
 *
 * For each route, with a real session: the server answered, and **the page is not one of our own
 * failure screens.** That second half is the whole idea. A 200 is not success — an error boundary
 * returns 200 with an apology painted on it, which is exactly how a broken screen looks healthy to
 * every check we had. So it reads the rendered HTML and fails on:
 *
 *   - "This screen didn't load" / "This page didn't load"  — an error boundary caught a throw
 *   - "is temporarily unavailable"                          — the global boundary
 *   - "Application error"                                   — Next's own last-resort text
 *   - "We couldn't find that"                               — a 404 screen where a record was expected
 *
 * ⚠️ **Script contents are stripped before scanning, and that is not tidiness.** Next ships a
 * prefetched copy of the not-found payload inside `<script>` on perfectly healthy pages — scanning
 * raw HTML reports every page in the product as broken. Found the first time this ran.
 *
 * ## Roles, not just routes
 *
 * Each app is walked twice where it has scoped roles: once as an owner, who must reach everything,
 * and once as a restricted role, who must be REFUSED the screens that are not theirs and must still
 * reach the ones that are. A guard that refuses everybody passes every negative test and breaks the
 * product, so both directions are asserted.
 *
 * ## What it deliberately does NOT cover
 *
 * - **Clicking.** Three of the four bugs found on 2026-09-14 needed a click: a server action that
 *   did not exist on the RLS proxy, "mark all read" leaving one item unread, a dropped `read` flag.
 *   Those need a browser driving the page. This is the cheaper half, and it is the half that runs
 *   anywhere with no browser download.
 * - **The login FORM.** Sessions are minted with each app's own signing key rather than typed into
 *   the form, because a server action's wire protocol is a moving target and a test coupled to it
 *   rots. `/login` is fetched and checked for its form, so a dead login page is still caught.
 *
 * ## Running it
 *
 *     pnpm route-walk                # every app that is running
 *     pnpm route-walk --app pms      # one of them
 *
 * Start the apps first (`pnpm --filter @revio/pms dev`). An app that is not listening is reported as
 * skipped, never as passing — "nothing answered" must never read as "nothing is wrong".
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

// fileURLToPath, not URL.pathname — this repo lives under a directory with a space in its name, and
// .pathname percent-encodes it. That bug once made copy-lint report "clean" having scanned 0 files.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The screens that must never look like a failure. `:id` is filled from real data below. */
const APPS = {
  "channel-manager": {
    port: 3000, cookie: "revio_session", label: "RevioLink",
    // A commercial role belongs here and must reach everything: the roles in RevioLink differ in
    // what they may WRITE, not in what they may read.
    secondRole: { role: "distribution_manager", expect: "all" },
    routes: [
      "/dashboard", "/calendar", "/bulk-update", "/rooms-rates", "/channels", "/mapping",
      "/reservations", "/sync", "/errors", "/audit", "/restrictions", "/users", "/help",
      "/settings", "/settings/property", "/settings/team", "/settings/billing",
      "/settings/account", "/settings/emails", "/settings/delivery",
      "/search?q=deluxe",
    ],
  },
  reservation: {
    port: 3002, cookie: "revio_crs_session", label: "RevioCRS",
    secondRole: { role: "distribution_manager", expect: "all" },
    routes: [
      "/dashboard", "/reservations", "/reservations/new", "/guests", "/waitlist", "/reports",
      "/inventory", "/rooms-rates", "/rates", "/bulk", "/distribution", "/booking-engine",
      "/activity", "/help", "/settings", "/settings/property", "/settings/taxes",
      "/settings/users", "/settings/policies", "/settings/billing", "/settings/account",
      "/search?q=deluxe",
      "/reservations/:reservationId", "/guests/:guestId",
    ],
  },
  pms: {
    port: 3003, cookie: "revio_pms_session", label: "RevioPMS",
    /*
     * ⚠️ The regression test for the hole closed on 2026-09-14.
     *
     * Accounts are one shared identity, so a commercial role authenticates against RevioPMS
     * perfectly well — and `roleAllowsPath` used to end `if (!allowed) return true`, handing anyone
     * it had never heard of the front desk, folios, guest identity documents and Close Day. Every
     * screen here must now turn this account away, and be SEEN to.
     */
    secondRole: { role: "distribution_manager", expect: "none" },
    routes: [
      "/dashboard", "/calendar", "/guests", "/folios", "/register", "/minibar",
      "/minibar/catalog", "/housekeeping", "/rooms", "/maintenance", "/users",
      "/configuration", "/closeday", "/activity", "/help", "/settings",
      "/settings/property", "/settings/operations", "/settings/connections",
      "/settings/billing", "/settings/account",
      "/search?q=deluxe",
      // The route the founder's white page came from. Walked with a REAL id, because the bug was
      // only reachable with one.
      "/reservation/:reservationId", "/guests/:guestId", "/rooms/:unitId",
      /* ⚠️ The folio screen SEEDS the bill on open — it is the main production caller of
         `ensureFolio`, which creates the folio row and then posts accommodation, taxes and fees.
         Walking it means a screen that both reads and writes is exercised, not just read. */
      "/folio/:reservationId",
    ],
  },
  operator: {
    port: 3001, cookie: "revio_op_session", label: "Operator", operator: true,
    routes: [
      "/overview", "/clients", "/leads", "/support", "/plans", "/billing", "/health",
      "/errors", "/auth-log", "/integrations", "/connectivity", "/analytics",
      "/platform-history", "/settings/account", "/settings/company", "/settings/staff",
      "/settings/platform",
      "/search?q=sofia",
      "/clients/:tenantId",
    ],
  },
};

/**
 * Our own failure screens, in the words they actually print — plus the one marker that does not
 * depend on our copy at all.
 *
 * ⚠️ **`<!--$!-->` is the important one.** React streams it in place of a suspense boundary whose
 * server render THREW, with the digest beside it in a `<template data-dgst>`. It appears in dev and
 * in production, whatever the boundary then paints, and it is the only check here that cannot be
 * defeated by rewording a screen.
 *
 * It had to be: the first version matched only our own sentences, and a deliberately broken
 * reservation page sailed through — in dev, Next renders its own error output and our boundary's
 * words never appear. A check that only sees the failures it was told to expect is a check that
 * passes on the failure nobody predicted, which is every interesting one.
 */
const FAILURE_MARKERS = [
  ["error boundary", /This (screen|page) didn.{1,3}t load/i],
  ["global error", /is temporarily unavailable/i],
  ["next fallback", /Application error/i],
  ["not found", /We couldn.{1,3}t find that/i],
];

/**
 * ⚠️ Strip scripts before scanning.
 *
 * Next inlines a prefetched not-found payload inside `<script>` on healthy pages. Scanning the raw
 * HTML reports every screen in the product as broken — which is what happened the first time this
 * ran, and it is the kind of false alarm that gets a check switched off.
 */

/**
 * ⚠️ `redirect()` and `notFound()` THROW, and React marks their boundary exactly like a crash.
 *
 * `/settings` forwards to its first sub-section, so its perfectly correct redirect produced the same
 * `<!--$!-->` as a broken page and this walk reported it as broken on its first honest run. Telling
 * the two apart is the difference between a check people trust and one they switch off.
 *
 * `NEXT_REDIRECT` is control flow and benign here — the destination is a route in its own right and
 * is walked separately. `NEXT_NOT_FOUND` is NOT benign: a route we expected to exist answering
 * "no such thing" is exactly the founder's dead link.
 *
 * The message is only present in development. In production a redirect is a real 3xx, which the
 * status check below handles, so nothing is lost by the message being absent.
 */
function erroredForRealReason(html) {
  if (!/<!--\$!-->/.test(html)) return false;
  const reasons = [...html.matchAll(/data-msg="([^"]*)"/g)].map((m) => m[1]);
  if (reasons.length === 0) return true; // production: no message, so take the marker at its word
  return reasons.some((r) => !r.includes("NEXT_REDIRECT"));
}

function visibleText(html) {
  // Comments are KEPT: React's errored-boundary marker is one.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
}

function psql(sql) {
  try {
    return execFileSync("psql", ["-d", process.env.WALK_DB ?? "revio_dev", "-tAc", sql], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function secretFor(app) {
  const file = join(ROOT, "apps", app, ".env.local");
  if (!existsSync(file)) return null;
  const m = /^AUTH_SECRET=(.*)$/m.exec(readFileSync(file, "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * A session for this account, signed with the app's own key — the same token its login would mint.
 *
 * ⚠️ `jose` is resolved from the APP, not from the repo root. pnpm does not hoist it, so a plain
 * import finds nothing and the whole walk dies before it checks a single screen.
 */
async function mintSession(app, sub, kind) {
  const require = createRequire(join(ROOT, "apps", app, "package.json"));
  const { SignJWT } = require("jose");
  const secret = secretFor(app);
  if (!secret) return null;
  return new SignJWT({ kind, sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
    .sign(new TextEncoder().encode(secret));
}

async function alive(port) {
  try {
    const res = await fetch(`http://localhost:${port}/login`, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function walk(app, cfg, token, roleLabel, ids, expect) {
  const failures = [];
  const unwalkable = [];
  const slowRoutes = [];
  let checked = 0;

  for (const raw of cfg.routes) {
    /*
     * ⚠️ A route we could not build is REPORTED, never skipped quietly.
     *
     * The first version of this dropped any route whose id was missing and still printed "all
     * healthy" — so a deliberately broken reservation page passed, because its id had never been
     * resolved and the route was never fetched. A walk that silently narrows itself is the same
     * failure as a skipped app reading as a passing one, one level down.
     */
    const missing = [...raw.matchAll(/:(\w+)/g)].map((m) => m[1]).filter((k) => !ids[k]);
    if (missing.length) {
      /*
       * ⚠️ Still reported, never silent — but a FAILURE only when the account could have had one.
       *
       * A route we cannot build hid a genuinely broken page once, which is why this is loud. It is
       * not a fault, though, when the account legitimately has no such record: walking a brand-new
       * hotel — the empty-state run that answers "does the second product break on empty?" — cannot
       * open a reservation it has never taken. `--allow-unwalkable` is that case, stated explicitly
       * rather than quietly narrowing the run.
       */
      (allowUnwalkable ? unwalkable : failures).push(
        `${raw} — not walked: this account has no ${missing.join(", ")}`,
      );
      continue;
    }
    const route = raw.replace(/:(\w+)/g, (_, k) => ids[k]);

    /*
     * ⚠️ One retry, and only for a timeout.
     *
     * A cold `next dev` compiles a route on its first request, and with four apps warming up at once
     * that overran 20 seconds — reporting a perfectly healthy CRS screen as hung. The same route
     * answered in 0.24s once compiled. A check that cries wolf on the machine's mood is a check
     * people stop reading.
     *
     * Timing out TWICE is still a failure, and a first-attempt timeout is still printed, so a page
     * that is genuinely slow for a person does not hide behind the retry.
     */
    let res = null, html = "", slow = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(`http://localhost:${cfg.port}${route}`, {
          headers: { cookie: `${cfg.cookie}=${token}` },
          redirect: "manual",
          signal: AbortSignal.timeout(attempt === 0 ? 20000 : 60000),
        });
        html = res.status === 200 ? visibleText(await res.text()) : "";
        break;
      } catch (e) {
        res = null;
        slow = true;
        /* ⚠️ A DROPPED CONNECTION is retried, not reported as a broken screen.
           `next dev` restarts itself when it nears its memory ceiling — "Server is approaching the
           used memory threshold, restarting..." — and every request in flight fails with a bare
           "fetch failed". The first version called five perfectly healthy RevioCRS screens broken
           because the server bounced underneath it. Three strikes still catches a server that is
           genuinely gone, and the pause gives a restarting one time to come back. */
        if (attempt === 2) failures.push(`${route} — no answer after 3 tries (${e.message})`);
        else await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!res) continue;
    if (slow) slowRoutes.push(route);
    checked++;

    const refused = res.status === 307 || res.status === 302;
    const sentTo = (res.headers.get("location") ?? "").replace(/^https?:\/\/[^/]+/, "");

    if (expect === "none") {
      // Every screen must turn this role away, and toward the screen that explains why rather than
      // to a login page or a loop.
      if (res.status >= 500) failures.push(`${route} — ${res.status} instead of a refusal`);
      else if (!refused) failures.push(`${route} — OPENED for ${roleLabel}, which must not happen`);
      else if (!sentTo.startsWith("/no-access")) failures.push(`${route} — refused, but sent to ${sentTo || "?"}`);
      continue;
    }
    if (expect === "all") {
      if (res.status >= 500) failures.push(`${route} — ${res.status} for ${roleLabel}`);
      else if (refused && !/^\/(?!login|logout|locked|no-access)/.test(sentTo)) {
        failures.push(`${route} — ${roleLabel} was sent to ${sentTo || "?"}`);
      } else if (res.status === 200 && erroredForRealReason(html)) {
        failures.push(`${route} — server render errored for ${roleLabel}`);
      }
      continue;
    }

    if (res.status >= 500) { failures.push(`${route} — ${res.status}`); continue; }
    if (refused) {
      /* A forwarder — `/settings` sending you to its first sub-section — is the product working.
         Its destination is walked in its own right, so nothing goes unchecked by allowing it. Being
         sent to /login or another app IS a failure, and still reads as one. */
      const to = res.headers.get("location") ?? "?";
      const forwarded = /^\/(?!login|logout|locked|no-access|welcome)/.test(to.replace(/^https?:\/\/[^/]+/, ""));
      if (!forwarded) failures.push(`${route} — sent to ${to}`);
      continue;
    }
    if (res.status !== 200) { failures.push(`${route} — ${res.status}`); continue; }
    if (erroredForRealReason(html)) { failures.push(`${route} — server render errored`); continue; }
    for (const [name, re] of FAILURE_MARKERS) {
      if (re.test(html)) failures.push(`${route} — ${name}`);
    }
  }
  return { checked, failures, slowRoutes, unwalkable };
}

const only = process.argv.includes("--app") ? process.argv[process.argv.indexOf("--app") + 1] : null;
const allowUnwalkable = process.argv.includes("--allow-unwalkable");
const report = [];
let anyFailure = false;
let anyRan = false;
const skipped = [];

for (const [app, cfg] of Object.entries(APPS)) {
  if (only && only !== app) continue;

  if (!(await alive(cfg.port))) {
    // ⚠️ Skipped is not passed. An app nobody started must never read as an app with nothing wrong.
    report.push(`  ${cfg.label.padEnd(11)} SKIPPED — nothing listening on :${cfg.port}`);
    skipped.push(cfg.label);
    continue;
  }

  // The login page is checked directly: sessions are minted below rather than typed into the form,
  // so without this a dead login page would go unnoticed.
  const login = visibleText(await (await fetch(`http://localhost:${cfg.port}/login`)).text());
  if (!/type="password"/.test(login) && !/password/i.test(login)) {
    report.push(`  ${cfg.label.padEnd(11)} FAIL — /login has no password field`);
    anyFailure = true;
    continue;
  }

  /*
   * ⚠️ Walk as the owner of the tenant with the MOST data, not whichever row comes back first.
   *
   * "The first owner" picked a hotel with no guest records, so `/guests/[id]` could not be walked at
   * all — the screen went unchecked while the run looked thorough. A fixture chosen by luck tests
   * whatever that luck reaches.
   */
  /*
   * `WALK_AS=<userId>` walks as a NAMED account instead of the best-stocked one.
   *
   * Added to answer a question the tests could not: a hotel that opens its second product two weeks
   * later arrives at every screen with nothing in it — no rooms, no rates, no channels. "It works"
   * had only ever been observed on a tenant with seeded data, which is the one tenant whose screens
   * are guaranteed to have something to render.
   */
  const ownerId = process.env.WALK_AS
    ? process.env.WALK_AS
    : cfg.operator
    ? psql(`select id from "OperatorUser" where active = true limit 1`)
    : psql(`
        select u.id from "User" u
        where u.role = 'owner'
        order by (select count(*) from "Reservation" r
                  join "Property" p on p.id = r."propertyId"
                  where p."tenantId" = u."tenantId") desc
        limit 1`);

  /*
   * ⚠️ Ids must belong to THIS account's tenant, and to a property it can actually open.
   *
   * The first version took "the newest reservation" outright and got `test-aa-1` — a leftover row
   * belonging to somebody else. RLS hid it correctly, the page refused correctly, and the walk
   * learned nothing about the screen. A fixture from the wrong tenant tests the isolation, not the
   * feature.
   */
  const scope = cfg.operator
    ? ""
    : `and p."tenantId" = (select "tenantId" from "User" where id = '${ownerId}')`;
  const ids = cfg.operator
    ? { tenantId: psql(`select id from "Tenant" where "isDemo" = true limit 1`) }
    : {
        reservationId: psql(`select r.id from "Reservation" r join "Property" p on p.id = r."propertyId" where true ${scope} order by r."importedAt" desc limit 1`),
        guestId: psql(`select g.id from "Guest" g join "Property" p on p.id = g."propertyId" where true ${scope} limit 1`),
        unitId: psql(`select u.id from "Unit" u join "Property" p on p.id = u."propertyId" where true ${scope} limit 1`),
      };
  if (!ownerId) {
    report.push(`  ${cfg.label.padEnd(11)} SKIPPED — no seeded account in the local database`);
    skipped.push(cfg.label);
    continue;
  }

  const token = await mintSession(app, ownerId, cfg.operator ? "operator" : "hotel");
  if (!token) {
    report.push(`  ${cfg.label.padEnd(11)} SKIPPED — no AUTH_SECRET in apps/${app}/.env.local`);
    skipped.push(cfg.label);
    continue;
  }

  anyRan = true;
  const { checked, failures, slowRoutes, unwalkable } = await walk(app, cfg, token, "owner", ids, false);

  if (failures.length) {
    anyFailure = true;
    report.push(`  ${cfg.label.padEnd(11)} ${failures.length} broken of ${checked}:`);
    for (const f of failures) report.push(`      ${f}`);
  } else {
    report.push(`  ${cfg.label.padEnd(11)} ${checked} screens, all healthy`);
  }
  /*
   * The second pass: the same screens, as somebody who should see a different amount of them.
   *
   * ⚠️ Both directions are asserted, because only one of them is a bug people notice. A guard that
   * refuses EVERYBODY passes every "is it refused?" test ever written and breaks the product for
   * real staff — so `expect: "all"` matters exactly as much as `expect: "none"`.
   */
  if (cfg.secondRole) {
    const otherId = psql(`select id from "User" where role = '${cfg.secondRole.role}' limit 1`);
    if (!otherId) {
      report.push(`      role pass SKIPPED — no ${cfg.secondRole.role} account seeded`);
    } else {
      const otherToken = await mintSession(app, otherId, "hotel");
      const r = await walk(app, cfg, otherToken, cfg.secondRole.role, ids, cfg.secondRole.expect);
      if (r.failures.length) {
        anyFailure = true;
        report.push(`      as ${cfg.secondRole.role}: ${r.failures.length} wrong —`);
        for (const f of r.failures) report.push(`        ${f}`);
      } else {
        const what = cfg.secondRole.expect === "none" ? "refused every screen" : `reached all ${r.checked}`;
        report.push(`      as ${cfg.secondRole.role}: ${what} ✓`);
      }
    }
  }
  if (unwalkable.length) {
    report.push(`      ${unwalkable.length} route(s) this account has no record for:`);
    for (const u of unwalkable) report.push(`        ${u}`);
  }
  if (slowRoutes.length) {
    // Not a failure, but said out loud: on a warm server this means the page really is slow.
    report.push(`      slow on first request (dev compile, or genuinely slow): ${slowRoutes.join(", ")}`);
  }
}

console.log("\nroute-walk — every screen, signed in\n");
for (const line of report) console.log(line);

if (!anyRan) {
  console.log("\nNothing was walked. Start an app first, e.g. `pnpm --filter @revio/pms dev`.");
  process.exit(1);
}
if (anyFailure) {
  console.error(
    "\nroute-walk FAILED.\n" +
      "A 200 is not success here: an error boundary answers 200 with an apology painted on it,\n" +
      "which is exactly how a broken screen looked healthy to every other check in this repo.\n" +
      "Open the route above in a browser — it is broken for a real signed-in person.",
  );
  process.exit(1);
}
/*
 * ⚠️ Success is qualified by what was NOT walked.
 *
 * This printed "every screen loaded" while two of the four apps were skipped for not running — the
 * exact failure this script exists to catch, committed by the script itself one level up. An
 * unqualified success line over a partial run is how a green tick comes to mean nothing.
 */
if (skipped.length) {
  console.log(
    `\nroute-walk: PARTIAL — ${skipped.length} app(s) not walked at all (${skipped.join(", ")}).\n` +
      `What ran is healthy. What did not run is unknown, which is not the same thing.\n`,
  );
} else if (only) {
  // ⚠️ `--app` narrows the run, so the summary must narrow with it. This said "every app" while
  // walking one — the third time this script committed, in its own output, the exact dishonesty it
  // was written to catch. A success line must name what it did NOT look at.
  console.log(`\nroute-walk: every screen in ${only} loaded. The other apps were not walked.\n`);
} else {
  console.log("\nroute-walk: every screen in every app loaded, and none of them is a failure screen.\n");
}
