import { createSign } from "node:crypto";

/**
 * Google Analytics and Search Console, read server-side, so nobody has to log into Google to see
 * how the website is doing.
 *
 * ## ⚠️ This deliberately stores NOTHING
 *
 * The obvious design is a nightly job writing into our own table, and it was rejected: Search
 * Console keeps sixteen months, and the founder's call is that anything needing more than that is a
 * question to ask *in Analytics itself*. This screen answers "how are the normal periods going" —
 * seven, twenty-eight, ninety days — which the APIs serve directly. No table, no migration, no job
 * to notice has stopped, and no second copy of Google's numbers to disagree with Google.
 *
 * ## Authentication is a service account, not a login
 *
 * A signed JWT exchanged for an access token — the standard server-to-server flow. No OAuth
 * redirect, no refresh token to lose, nobody's personal Google account in the path. The key is a
 * secret and is read from the environment; it is never logged, and no function here returns it.
 *
 * ⚠️ NO `googleapis` DEPENDENCY. That package is tens of megabytes to sign one JWT and make two
 * POSTs. `node:crypto` signs RS256 in four lines.
 *
 * ## ⚠️ Inert until configured
 *
 * Three variables. Missing any of them, every function returns `configured: false` and the screen
 * says so plainly rather than erroring — the same contract as the support mailbox. See
 * `docs/ACTION-REQUIRED.md`.
 *
 *   GOOGLE_INSIGHTS_CLIENT_EMAIL   the service account
 *   GOOGLE_INSIGHTS_PRIVATE_KEY    its key (literal \n escapes are unescaped below)
 *   GA4_PROPERTY_ID                numeric, from Analytics → Admin → Property details
 *   GSC_SITE_URL                   exactly as Search Console spells it, e.g. https://reviosoft.app/
 *
 * The service account's email must be added as a **Viewer** on the GA4 property and as a user on
 * the Search Console property. Granting it in Google is the only step that cannot be done from here.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

export interface InsightsConfig {
  clientEmail: string;
  privateKey: string;
  propertyId: string;
  siteUrl: string;
}

/**
 * What is wrong with the configuration, in words the screen can print.
 *
 * ⚠️ `null` used to be the only answer, and it was not enough. A key was pasted that turned out to
 * be the 40-character **key ID** rather than the key — an easy mistake, because the Keys page shows
 * the id in large type right after you create one — and the screen could only say "not configured",
 * which sends somebody back to re-do a step they already did correctly.
 */
export type ConfigProblem =
  | { kind: "missing"; fields: string[] }
  | { kind: "key-looks-like-an-id" }
  | { kind: "key-not-a-pem" };

/**
 * Reads the configuration.
 *
 * ## ⚠️ Paste the WHOLE JSON file if you like
 *
 * `GOOGLE_INSIGHTS_CREDENTIALS` takes the service-account JSON exactly as Google downloads it, and
 * the email and the key are read out of it. That is one variable instead of three, nothing to
 * extract by hand, and — the part that actually bites — no `\n` escaping to get wrong.
 *
 * The three separate variables still work, for a deployment that already has them.
 */
export function readConfig(
  env: Record<string, string | undefined> = process.env,
): { config: InsightsConfig } | { problem: ConfigProblem } | null {
  const blob = env.GOOGLE_INSIGHTS_CREDENTIALS?.trim();
  let clientEmail = env.GOOGLE_INSIGHTS_CLIENT_EMAIL?.trim();
  let rawKey = env.GOOGLE_INSIGHTS_PRIVATE_KEY?.trim();

  if (blob?.startsWith("{")) {
    try {
      const parsed = JSON.parse(blob) as { client_email?: string; private_key?: string };
      clientEmail = parsed.client_email?.trim() || clientEmail;
      rawKey = parsed.private_key?.trim() || rawKey;
    } catch {
      return { problem: { kind: "key-not-a-pem" } };
    }
  }
  /* Somebody may reasonably paste the whole file into the key variable instead. Accept that too. */
  if (rawKey?.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawKey) as { client_email?: string; private_key?: string };
      clientEmail = parsed.client_email?.trim() || clientEmail;
      rawKey = parsed.private_key?.trim();
    } catch {
      return { problem: { kind: "key-not-a-pem" } };
    }
  }

  const propertyId = env.GA4_PROPERTY_ID?.trim();
  const siteUrl = env.GSC_SITE_URL?.trim();

  const missing = [
    !clientEmail && "GOOGLE_INSIGHTS_CLIENT_EMAIL",
    !rawKey && "GOOGLE_INSIGHTS_PRIVATE_KEY",
    !propertyId && "GA4_PROPERTY_ID",
    !siteUrl && "GSC_SITE_URL",
  ].filter(Boolean) as string[];
  /* Nothing at all set is not a problem to report — it is a screen that has not been connected yet. */
  if (missing.length === 4) return null;
  if (missing.length) return { problem: { kind: "missing", fields: missing } };

  const key = rawKey!.replace(/\\n/g, "\n");
  /*
    ⚠️ A service-account KEY ID is 40 hex characters, and it is the thing the console shows most
    prominently once a key exists. Named specifically, because "invalid key" would send somebody
    back to Google to redo a step they did correctly.
  */
  if (/^[a-f0-9]{40}$/i.test(key)) return { problem: { kind: "key-looks-like-an-id" } };
  if (!key.includes("-----BEGIN")) return { problem: { kind: "key-not-a-pem" } };

  return { config: { clientEmail: clientEmail!, privateKey: key, propertyId: propertyId!, siteUrl: siteUrl! } };
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Cached until shortly before it expires. A token lasts an hour; re-minting one per request is
 *  a signature and a round trip for nothing. */
let cached: { token: string; expiresAt: number } | null = null;

export async function accessToken(config: InsightsConfig, now = Date.now()): Promise<string> {
  if (cached && cached.expiresAt > now + 60_000) return cached.token;

  const iat = Math.floor(now / 1000);
  const claims = {
    iss: config.clientEmail,
    scope: SCOPES,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  };
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  const assertion = `${head}.${body}.${b64url(signer.sign(config.privateKey))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    /* ⚠️ Never include the response body: a failed token exchange can echo parts of the assertion. */
    throw new Error(`Google token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

/** Only for tests — the module-level cache would otherwise leak between them. */
export function resetTokenCache() {
  cached = null;
}

/* ------------------------------------------------------------------ */
/* Pure helpers. Tested directly; everything above needs the network.   */
/* ------------------------------------------------------------------ */

export const PERIODS = [7, 28, 90] as const;
export type Period = (typeof PERIODS)[number];

/**
 * The window to ask each API for, and the matching one before it.
 *
 * ⚠️ Both END YESTERDAY, not today. A day in progress is always down on the same day complete, so
 * including today makes every period look like a decline — and it is the first thing somebody
 * screenshots and worries about.
 */
export function windowFor(days: Period, today = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };
  return {
    current: { startDate: iso(shift(days)), endDate: iso(shift(1)) },
    previous: { startDate: iso(shift(days * 2)), endDate: iso(shift(days + 1)) },
  };
}

/** Percentage change, or null when there is no base to compare against. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface TrafficDay { day: string; people: number; views: number }
export interface QueryRow { query: string; clicks: number; impressions: number; ctr: number; position: number }
export interface PageRow { page: string; clicks: number; impressions: number }

/** GA4 returns dates as `20260921`. Everything else on this site speaks `YYYY-MM-DD`. */
export function parseGaDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

interface GaRow { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }

export function shapeTraffic(rows: GaRow[]): TrafficDay[] {
  return rows
    .map((r) => ({
      day: parseGaDate(r.dimensionValues?.[0]?.value ?? ""),
      people: Number(r.metricValues?.[0]?.value ?? 0),
      views: Number(r.metricValues?.[1]?.value ?? 0),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))
    .sort((a, b) => a.day.localeCompare(b.day));
}

interface GscRow { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

export function shapeQueries(rows: GscRow[]): QueryRow[] {
  return rows.map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    /* Google sends a fraction; a reader wants a percentage, and one decimal is all the precision
       an impression count of this size supports. */
    ctr: Math.round((r.ctr ?? 0) * 1000) / 10,
    position: Math.round((r.position ?? 0) * 10) / 10,
  }));
}

export function shapePages(rows: GscRow[], siteUrl: string): PageRow[] {
  return rows.map((r) => {
    const full = r.keys?.[0] ?? "";
    /* The site's own origin is stripped: a column of identical prefixes is a column of noise. */
    const page = full.startsWith(siteUrl) ? full.slice(siteUrl.length - 1) || "/" : full;
    return { page, clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 };
  });
}

/** Which of the two languages a Search Console page belongs to. */
export function localeOf(page: string): "bg" | "en" {
  return page === "/bg" || page.startsWith("/bg/") ? "bg" : "en";
}

export function splitByLocale(pages: PageRow[]) {
  const totals = { bg: { clicks: 0, impressions: 0 }, en: { clicks: 0, impressions: 0 } };
  for (const p of pages) {
    const side = totals[localeOf(p.page)];
    side.clicks += p.clicks;
    side.impressions += p.impressions;
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* The two calls, and the one function the screen uses.                 */
/* ------------------------------------------------------------------ */

async function ga(config: InsightsConfig, token: string, body: unknown) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Analytics returned ${res.status}`);
  return (await res.json()) as { rows?: GaRow[] };
}

async function gsc(config: InsightsConfig, token: string, body: unknown) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Search Console returned ${res.status}`);
  return (await res.json()) as { rows?: GscRow[] };
}

export interface SiteInsights {
  configured: boolean;
  /** What is wrong with the SETUP, as opposed to a Google failure. */
  problem?: ConfigProblem;
  error?: string;
  period: Period;
  window: { startDate: string; endDate: string };
  traffic: TrafficDay[];
  people: { current: number; previous: number; deltaPct: number | null };
  views: { current: number; previous: number; deltaPct: number | null };
  search: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    clicksDeltaPct: number | null;
  };
  queries: QueryRow[];
  pages: PageRow[];
  byLocale: ReturnType<typeof splitByLocale>;
}

const EMPTY = (period: Period, window: { startDate: string; endDate: string }): SiteInsights => ({
  configured: false,
  period,
  window,
  traffic: [],
  people: { current: 0, previous: 0, deltaPct: null },
  views: { current: 0, previous: 0, deltaPct: null },
  search: { clicks: 0, impressions: 0, ctr: 0, position: 0, clicksDeltaPct: null },
  queries: [],
  pages: [],
  byLocale: { bg: { clicks: 0, impressions: 0 }, en: { clicks: 0, impressions: 0 } },
});

/**
 * Everything the screen needs, in one call.
 *
 * ⚠️ A failure is RETURNED, never thrown. This is one panel on an operator console; a revoked key or
 * a Google outage must not take down a page that also shows billing and client health. The screen
 * prints the reason.
 */
export async function getSiteInsights(period: Period = 28): Promise<SiteInsights> {
  const w = windowFor(period);
  const read = readConfig();
  if (!read) return EMPTY(period, w.current);
  if ("problem" in read) return { ...EMPTY(period, w.current), problem: read.problem };
  const config = read.config;

  try {
    const token = await accessToken(config);
    const metrics = [{ name: "activeUsers" }, { name: "screenPageViews" }];

    const [daily, prior, queries, pages, priorSearch] = await Promise.all([
      ga(config, token, { dateRanges: [w.current], dimensions: [{ name: "date" }], metrics }),
      ga(config, token, { dateRanges: [w.previous], metrics }),
      gsc(config, token, { ...w.current, dimensions: ["query"], rowLimit: 25 }),
      gsc(config, token, { ...w.current, dimensions: ["page"], rowLimit: 25 }),
      gsc(config, token, { ...w.previous, rowLimit: 1 }),
    ]);

    const traffic = shapeTraffic(daily.rows ?? []);
    const people = traffic.reduce((s, d) => s + d.people, 0);
    const views = traffic.reduce((s, d) => s + d.views, 0);
    const prev = prior.rows?.[0]?.metricValues ?? [];
    const prevPeople = Number(prev[0]?.value ?? 0);
    const prevViews = Number(prev[1]?.value ?? 0);

    const totals = shapeQueries(queries.rows ?? []).reduce(
      (s, q) => ({ clicks: s.clicks + q.clicks, impressions: s.impressions + q.impressions }),
      { clicks: 0, impressions: 0 },
    );
    const prevClicks = priorSearch.rows?.[0]?.clicks ?? 0;
    const shapedPages = shapePages(pages.rows ?? [], config.siteUrl);

    return {
      configured: true,
      period,
      window: w.current,
      traffic,
      people: { current: people, previous: prevPeople, deltaPct: delta(people, prevPeople) },
      views: { current: views, previous: prevViews, deltaPct: delta(views, prevViews) },
      search: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions ? Math.round((totals.clicks / totals.impressions) * 1000) / 10 : 0,
        position: 0,
        clicksDeltaPct: delta(totals.clicks, prevClicks),
      },
      queries: shapeQueries(queries.rows ?? []),
      pages: shapedPages,
      byLocale: splitByLocale(shapedPages),
    };
  } catch (e) {
    return { ...EMPTY(period, w.current), configured: true, error: (e as Error).message };
  }
}
