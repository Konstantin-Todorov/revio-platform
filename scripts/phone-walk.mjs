#!/usr/bin/env node
/**
 * Every screen, on a phone: does anything run off the edge?
 *
 * ## Why this exists
 *
 * "Look at it on a phone" was done screen by screen, by hand, and the founder kept finding the
 * screens nobody had looked at: the notification panel hanging off the left edge, the client
 * menu cut in half (2026-09-29). A person cannot open 150 screens at 375px after every change; this
 * does, headless, against the local dev servers.
 *
 * It flags an element only when it is PARTLY on screen and cut by the edge — a drawer hidden
 * entirely off-canvas is deliberate, and so is a wide table inside its own horizontal scroller.
 * On each app's home screen it also opens the top-bar panels (notifications, account, property
 * switcher), because a panel is exactly the thing a page-level check never sees.
 *
 *   node scripts/phone-walk.mjs                 # all apps that are running locally
 *   node scripts/phone-walk.mjs --app pms       # one
 *
 * Signs in by minting each app's own session cookie, like `route-walk.mjs`. Local only: it refuses a
 * database that is not on localhost.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireRoot = createRequire(join(ROOT, "package.json"));
const { chromium } = requireRoot("playwright");

/** Screens a person sees before signing in — walked with no session at all. */
const PUBLIC = {
  "channel-manager": ["/login", "/forgot-password", "/signup", "/signup/sent", "/signup/existing"],
  reservation: ["/login", "/forgot-password"],
  pms: ["/login", "/forgot-password"],
  operator: ["/login", "/forgot-password"],
  // The booking step places a real (local, expiring) hold, exactly as a guest's click does.
  booking: ["/:slug", "/:slug/search?checkIn=:in&checkOut=:out&guests=2", "/:slug/book?checkIn=:in&checkOut=:out&guests=2&roomTypeId=:roomTypeId&ratePlanId=:ratePlanId"],
};

const APPS = {
  "channel-manager": {
    port: 3000, cookie: "revio_session", label: "RevioLink",
    routes: [
      "/dashboard", "/calendar", "/bulk-update", "/rooms-rates", "/channels", "/mapping", "/reservations", "/sync",
      "/users", "/help", "/help/requests", "/settings", "/settings/account", "/settings/billing", "/settings/delivery",
      "/settings/emails", "/settings/property", "/settings/team", "/search?q=a", "/start-trial/pms",
      "/welcome/property", "/welcome/rooms", "/welcome/prices", "/welcome/brand", "/welcome/golive",
    ],
  },
  reservation: {
    port: 3002, cookie: "revio_crs_session", label: "RevioCRS",
    routes: [
      "/dashboard", "/reservations", "/reservations/new", "/reservations/:reservationId", "/guests", "/guests/:guestId",
      "/waitlist", "/reports", "/inventory", "/bulk", "/distribution", "/booking-engine", "/booking-engine/look",
      "/booking-engine/extras", "/booking-engine/payments", "/rooms-rates/rooms", "/rooms-rates/rooms/:roomTypeId",
      "/rooms-rates/plans", "/rooms-rates/plans/:ratePlanId", "/rooms-rates/closures", "/activity", "/help",
      "/help/requests", "/settings", "/settings/account", "/settings/billing", "/settings/emails", "/settings/policies",
      "/settings/property", "/settings/taxes", "/settings/users", "/search?q=a", "/start-trial/pms",
      "/welcome/property", "/welcome/taxes", "/welcome/golive",
    ],
  },
  pms: {
    port: 3003, cookie: "revio_pms_session", label: "RevioPMS",
    routes: [
      "/dashboard", "/calendar", "/guests", "/guests/:guestId", "/folios", "/folio/:reservationId", "/register",
      "/minibar", "/minibar/catalog", "/housekeeping", "/rooms", "/rooms/:unitId", "/maintenance", "/users",
      "/walkin", "/configuration", "/configuration/compliance", "/configuration/deposits",
      "/configuration/end-of-day", "/configuration/housekeeping", "/configuration/invoices", "/configuration/outlets",
      "/closeday", "/activity", "/help", "/help/requests", "/settings", "/settings/account", "/settings/billing",
      "/settings/connections", "/settings/emails", "/settings/operations", "/settings/property",
      "/reservation/:reservationId", "/search?q=a", "/start-trial/crs",
      "/welcome/property", "/welcome/units", "/welcome/taxes", "/welcome/golive",
    ],
  },
  booking: { port: 3004, cookie: "", label: "RevioDirect", routes: [], publicOnly: true },
  operator: {
    port: Number(process.env.WALK_OPERATOR_PORT ?? 3001), cookie: "revio_op_session", label: "Operator", operator: true,
    routes: [
      "/overview", "/clients", "/clients?view=ours", "/clients/:tenantId", "/clients/:tenantId?tab=setup",
      "/clients/:tenantId?tab=channels", "/clients/:tenantId?tab=people", "/clients/:tenantId?tab=billing",
      "/clients/:tenantId?tab=history", "/leads", "/support", "/plans", "/billing", "/health", "/errors", "/auth-log",
      "/integrations", "/integrations/stripe", "/connectivity", "/analytics", "/website", "/platform-history",
      "/settings/account", "/settings/company", "/settings/staff", "/settings/platform", "/search?q=sofia",
    ],
  },
};


function env(app, key) {
  const file = join(ROOT, "apps", app, ".env.local");
  if (!existsSync(file)) return null;
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(readFileSync(file, "utf8"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const DB = process.env.DATABASE_URL ?? env("channel-manager", "DATABASE_URL") ?? "postgresql://localhost:5432/revio_dev";
if (!/@?(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB)) {
  console.error(`phone-walk: refusing a non-local database (${DB.replace(/\/\/[^@]*@/, "//…@")}).`);
  process.exit(2);
}
const psql = (sql) => execFileSync("psql", [DB, "-At", "-c", sql], { encoding: "utf8" }).trim().split("\n")[0] ?? "";

async function mint(app, sub, kind) {
  const require = createRequire(join(ROOT, "apps", app, "package.json"));
  const { SignJWT } = require("jose");
  const secret = env(app, "AUTH_SECRET");
  if (!secret) return null;
  return new SignJWT({ kind, sub }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 1800).sign(new TextEncoder().encode(secret));
}

async function alive(port) {
  // Patient: after a shared package changes, every dev server recompiles at once and the first
  // request can take a minute or more.
  for (let i = 0; i < 3; i++) {
    try { if ((await fetch(`http://localhost:${port}/login`, { signal: AbortSignal.timeout(90000) })).status < 500) return true; } catch { /* retry */ }
  }
  return false;
}

/** Measure, surviving a client-side redirect that lands mid-evaluation. */
async function measure(page) {
  for (let i = 0; i < 3; i++) {
    try { return await page.evaluate(offenders); } catch { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(800); }
  }
  return { sideways: false, out: ["(could not measure — the page kept navigating)"] };
}

/** Runs in the page. Partly-visible elements cut by the screen edge, outermost only. */
function offenders() {
  // The DEVICE width, not `innerWidth`: a phone browser widens the layout to fit whatever overflows,
  // so `innerWidth` grows to match the offender and hides it (the RevioLink calendar, 403px on 375).
  const W = Math.min(innerWidth, screen.width || innerWidth, 375);
  const scrolls = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (a === document.body || a === document.documentElement || a.tagName === "MAIN") continue;
      if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(a).overflowX)) return true;
    }
    return false;
  };
  const cut = (r) => (r.right > W + 1 && r.left < W - 1) || (r.left < -1 && r.right > 1);
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
    if (!cut(r) || scrolls(el)) continue;
    const p = el.parentElement;
    if (p && cut(p.getBoundingClientRect()) && !scrolls(p)) continue;
    const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50);
    out.push(`${el.tagName.toLowerCase()}[${Math.round(r.left)}..${Math.round(r.right)}] "${text}" .${String(el.className).slice(0, 70)}`);
  }
  const main = document.querySelector("main");
  const sideways = document.documentElement.scrollWidth > W + 1 || !!(main && main.scrollWidth > main.clientWidth + 1);
  return { sideways, out: out.slice(0, 6) };
}

const only = process.argv.includes("--app") ? process.argv[process.argv.indexOf("--app") + 1] : null;
const browser = await chromium.launch();
let failures = 0;
let screens = 0;

function report(label, r) {
  screens++;
  if (r.sideways || r.out.length) {
    failures++;
    console.log(`  ✗  ${label}${r.sideways ? "  (page scrolls sideways)" : ""}`);
    for (const o of r.out) console.log(`       ${o}`);
    return false;
  }
  console.log(`  ✓  ${label}`);
  return true;
}

/**
 * Every menu a page opens from a button — `aria-haspopup` or a collapsed `aria-expanded` — opened
 * one at a time and measured, then closed. Menus are where things hang off the edge; a page-level
 * look never sees them.
 */
async function walkMenus(page, path) {
  const buttons = page.locator('button[aria-haspopup]:visible, button[aria-expanded="false"]:visible');
  const n = Math.min(await buttons.count(), 12);
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const name = ((await b.getAttribute("aria-label")) || (await b.innerText().catch(() => "")) || "menu").trim().replace(/\s+/g, " ").slice(0, 30);
    try { await b.click({ timeout: 3000 }); } catch { continue; }
    await page.waitForTimeout(500);
    // A button that navigated is not a menu; come back and stop, the page is walked on its own.
    if (new URL(page.url()).pathname !== path.split("?")[0]) { await page.goBack().catch(() => {}); break; }
    const r = await measure(page);
    if (r.out.length) report(`${path} · menu "${name}"`, { sideways: false, out: r.out });
    else screens++;
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(250);
    if (await b.getAttribute("aria-expanded") === "true") await b.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function visit(page, base, path) {
  try { await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 }); } catch { /* judge what rendered */ }
  await page.waitForTimeout(600);
  const landed = new URL(page.url()).pathname;
  const note = landed !== path.split("?")[0] ? `  → ${landed}` : "";
  report(`${path}${note}`, await measure(page));
  if (!note) await walkMenus(page, path);
}

const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

for (const [app, cfg] of Object.entries(APPS)) {
  if (only && only !== app) continue;
  if (!(await alive(cfg.port))) { console.log(`\n${cfg.label}: not running on :${cfg.port} — skipped`); continue; }
  const base = `http://localhost:${cfg.port}`;

  // ── Before signing in ──
  const pub = PUBLIC[app] ?? [];
  if (pub.length) {
    const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const prop = psql(`select id from "Property" where "bookingEngineEnabled" and "publicSlug" is not null limit 1`);
    const ids = {
      slug: prop ? psql(`select "publicSlug" from "Property" where id='${prop}'`) : "",
      roomTypeId: prop ? psql(`select id from "RoomType" where "propertyId"='${prop}' and active limit 1`) : "",
      ratePlanId: prop ? psql(`select id from "RatePlan" where "propertyId"='${prop}' and active limit 1`) : "",
      in: inDays(30), out: inDays(32),
    };
    const context = await browser.newContext(phone);
    const page = await context.newPage();
    console.log(`\n${cfg.label} — before signing in (${pub.length})`);
    for (const route of pub) {
      const path = route.replace(/:(\w+)/g, (_, k) => ids[k] || "missing");
      if (path.includes("missing")) { console.log(`  –  ${route}  (no data to open it with)`); continue; }
      await visit(page, base, path);
    }
    await context.close();
  }
  if (cfg.publicOnly) continue;

  // ── Signed in ──
  const owner = cfg.operator
    ? psql(`select id from "OperatorUser" where active = true limit 1`)
    : process.env.WALK_AS ?? psql(`select u.id from "User" u where u.role='owner' and u.active order by (select count(*) from "Reservation" r where r."tenantId"=u."tenantId") desc limit 1`);
  const tenant = cfg.operator
    ? psql(`select id from "Tenant" where status='active' order by (select count(*) from "Channel" c where c."tenantId"="Tenant".id) desc limit 1`)
    : psql(`select "tenantId" from "User" where id='${owner}'`);
  const ids = cfg.operator ? { tenantId: tenant } : {
    reservationId: psql(`select id from "Reservation" where "tenantId"='${tenant}' limit 1`),
    guestId: psql(`select id from "Guest" where "tenantId"='${tenant}' limit 1`),
    roomTypeId: psql(`select id from "RoomType" where "tenantId"='${tenant}' limit 1`),
    ratePlanId: psql(`select id from "RatePlan" where "tenantId"='${tenant}' limit 1`),
    unitId: psql(`select id from "Unit" where "tenantId"='${tenant}' limit 1`),
  };
  const token = await mint(app, owner, cfg.operator ? "operator" : "hotel");
  if (!token) { console.log(`\n${cfg.label}: no AUTH_SECRET in .env.local — skipped`); continue; }

  const context = await browser.newContext(phone);
  await context.addCookies([{ name: cfg.cookie, value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  console.log(`\n${cfg.label} — signed in (${cfg.routes.length} screens, and every menu on them)`);
  for (const route of cfg.routes) {
    const path = route.replace(/:(\w+)/g, (_, k) => ids[k] || "missing");
    if (path.includes("missing")) { console.log(`  –  ${route}  (no data to open it with)`); continue; }
    await visit(page, base, path);
  }
  await context.close();
}

await browser.close();
console.log(`\nphone-walk: ${screens} screens and menus at 375px, ${failures} with something off the edge.`);
process.exit(failures ? 1 : 0);
