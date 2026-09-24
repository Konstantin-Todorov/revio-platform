export type MilestoneKind = "foundation" | "product" | "security" | "reliability" | "commercial";

export interface PlatformMilestone {
  id: string;
  date: string;
  title: string;
  summary: string;
  kind: MilestoneKind;
  evidence: readonly string[];
}

export type RoadmapHorizon = "now" | "next" | "later";
export type RoadmapPriority = "must" | "should" | "could";
export type RoadmapEffort = "S" | "M" | "L" | "XL";
export type RoadmapOwner = "Engineering" | "Operations" | "Founder + external";

export interface PlatformInitiative {
  id: string;
  horizon: RoadmapHorizon;
  priority: RoadmapPriority;
  effort: RoadmapEffort;
  owner: RoadmapOwner;
  title: string;
  outcome: string;
  dependency?: string;
}

/**
 * A curated operating history, not a second git log.
 *
 * Git remains the detailed source of truth. This list records the decisions and release boundaries
 * an operator needs in order to explain how the platform became what it is. Tiny fixes belong in
 * git; milestones belong here. Evidence is deliberately immutable commit ids or named controls.
 */
export const PLATFORM_MILESTONES = [
  {
    id: "shared-foundation",
    date: "2026-06-25",
    title: "One platform, one inventory core",
    summary: "The monorepo, pure domain core, shared database and app boundaries established the rule every later product still follows.",
    kind: "foundation",
    evidence: ["ad7df30", "f73f37f"],
  },
  {
    id: "access-perimeters",
    date: "2026-06-26",
    title: "Tenant and operator perimeters",
    summary: "Real authentication, entitlement gates, tenant scoping and the first Operator console made separate products one controlled platform.",
    kind: "security",
    evidence: ["d0398d2", "f7659ec", "ecd372e"],
  },
  {
    id: "distribution-loop",
    date: "2026-07-02",
    title: "The ARI loop reached Channex",
    summary: "Rate and availability edits pushed through the adapter, reservations pulled back, and encrypted tenant credentials moved connectivity out of demo-only territory.",
    kind: "product",
    evidence: ["943b87f", "e666414"],
  },
  {
    id: "crs-v1",
    date: "2026-07-03",
    title: "RevioCRS V1 completed",
    summary: "Holds, reservations, rates, restrictions, reports and shared availability turned channel data into a reservation system of record.",
    kind: "product",
    evidence: ["12a11c1", "90fe0f2", "aed9cf5"],
  },
  {
    id: "pms-v1",
    date: "2026-07-05",
    title: "RevioPMS completed the operating spine",
    summary: "Front desk, housekeeping, folios, outlets, maintenance and Close Day joined the same rooms and reservations; cross-product ARI push went live.",
    kind: "product",
    evidence: ["c9a9307", "37a3bf7"],
  },
  {
    id: "v2-foundations",
    date: "2026-07-10",
    title: "V2 made precedence and attribution explicit",
    summary: "Two-tier ARI precedence, push attribution, capability maps and integration seams replaced implicit behaviour with testable rules.",
    kind: "foundation",
    evidence: ["3a23f44", "afa0166"],
  },
  {
    id: "refinement-round",
    date: "2026-07-22",
    title: "RevioLink, RevioCRS and RevioPMS refined together",
    summary: "Shared bulk, calendar and rate-linkage work proved that common hotel concepts can be reused without letting apps import one another.",
    kind: "product",
    evidence: ["179f961", "98faf4c", "aaa71c6"],
  },
  {
    id: "reviodirect",
    date: "2026-08-03",
    title: "RevioDirect closed the guest loop",
    summary: "A public booking became the same reservation seen by CRS and PMS, with all-in pricing, holds, photos, extras and payment-token boundaries.",
    kind: "product",
    evidence: ["284cfe9", "860cc6b", "49142c6"],
  },
  {
    id: "production-isolation",
    date: "2026-08-05",
    title: "Database isolation enforced in production",
    summary: "All services moved to the restricted application role; pricing, client attention and relationship history turned Operator into a commercial console.",
    kind: "security",
    evidence: ["RLS 104/104", "4febbb0"],
  },
  {
    id: "guided-onboarding",
    date: "2026-08-12",
    title: "Onboarding began reusing what the platform knows",
    summary: "The first-run flow started skipping facts already supplied to another Revio product, while revocable sessions made the shared identity safer.",
    kind: "commercial",
    evidence: ["5c5432c", "227eb83"],
  },
  {
    id: "integrity-controls",
    date: "2026-08-15",
    title: "Concurrency and authorization became release gates",
    summary: "Atomic inventory claims closed the double-booking race, every write received a capability decision, and scheduled jobs stopped depending on an app process staying alive.",
    kind: "reliability",
    evidence: ["51b8eaf", "f9bfb01"],
  },
  {
    id: "operational-integrity",
    date: "2026-08-23",
    title: "PMS state changes became transactional",
    summary: "Room moves, stay assignment, the tape chart and automatic Close Day were rebuilt around all-or-nothing writes and explicit state invariants.",
    kind: "reliability",
    evidence: ["2997152", "98073e3", "f4a4133"],
  },
  {
    id: "enterprise-baseline",
    date: "2026-08-24",
    title: "Identity, monitoring and invoicing reached an operating baseline",
    summary: "Operator TOTP, breached-password refusal, auth events, key rotation, uptime alarms and legally numbered invoices made trust observable rather than implied.",
    kind: "security",
    evidence: ["bcbe2b1", "a9c0061", "2a3d971", "bc4e57a"],
  },
  {
    id: "verified-promotion",
    date: "2026-08-25",
    title: "Only verified code can promote",
    summary: "The six production services moved behind an exact-commit CI promotion gate, tested in green, red and recovery states.",
    kind: "reliability",
    evidence: ["0fc509a", "f3ea9f6"],
  },
  {
    id: "hotel-owned-channex-onboarding",
    date: "2026-08-26",
    title: "A hotel can connect its own distribution",
    summary: "RevioLink gained the real Channex provisioning and OTA connection path, while explicit states prevent a real hotel from accidentally creating a mock channel.",
    kind: "product",
    evidence: ["6c03cd8", "566b158"],
  },
  {
    id: "guest-data-rights",
    date: "2026-08-29",
    title: "The data-protection promises became operations",
    summary: "Export, correction and erasure exist as real writes with legal-retention exceptions and an audit trail, reached from the guest's own record behind a typed confirmation. The DPA had promised all three since before any of them existed.",
    kind: "security",
    evidence: ["1fad1d1"],
  },
  {
    id: "hotel-second-factor",
    date: "2026-08-30",
    title: "A second factor on the accounts that control the money",
    summary: "TOTP moved from the operator console into all four products, reusing the proven primitives rather than copying them. The accounts that set rates, read guest data and grant staff access can now be protected by the people who own them.",
    kind: "security",
    evidence: ["907366f", "63c08ed"],
  },
  {
    id: "external-review-closed",
    date: "2026-09-08",
    title: "An outside reading of the code, and four blockers closed",
    summary: "An independent review was commissioned against a written brief and its findings answered in full. The worst of them was not a broken feature but a working one nobody could reach, which is why the review was worth buying rather than self-assessing.",
    kind: "reliability",
    evidence: ["0c4b82a", "docs/REVIEW-RESPONSE-2026-09-08.md"],
  },
  {
    id: "money-actually-moves",
    date: "2026-09-11",
    title: "An invoice can be paid, and only by the person paying it",
    summary: "Stripe connections became visible and testable, an invoice sends itself and can be settled, a refund reaches the books without un-issuing the document, and a forged webhook cannot mark anything paid. Tourist tax moved inside the accommodation VAT base, correcting every bill that had been computed the other way.",
    kind: "commercial",
    evidence: ["eaadab6", "0bab985", "a7ae33b", "f828cac"],
  },
  {
    id: "self-serve-signup",
    date: "2026-09-12",
    title: "A hotel can start without us",
    summary: "Public signup with a thirty-day trial across all three products, a joining month that is prorated so thirty days means thirty, one trial per hotel, and a screen that says what happens when it ends. Running the real signup against production immediately found two bugs that no test had.",
    kind: "commercial",
    evidence: ["f9dc102", "f5ae9df", "2096f41", "6efe530"],
  },
  {
    id: "screens-are-walked",
    date: "2026-09-15",
    title: "Something that opens every screen and presses things",
    summary: "Eighty-nine screens are now opened signed-in on every check, and a second walker clicks what it finds. Typecheck and the lints had always passed on pages that were blank, dead-ended or crashed on open; this is the first check that looks.",
    kind: "reliability",
    evidence: ["cca2415", "f1fff2d"],
  },
  {
    id: "one-sign-in",
    date: "2026-09-16",
    title: "One sign-in opens every product the hotel bought",
    summary: "Central login replaced four separate doors, the login page was rebuilt as the first impression it is, and one Dialog primitive replaced the hand-rolled copies. Building it exposed that the second product's onboarding had been written, tested and never reachable.",
    kind: "product",
    evidence: ["ebb91d4", "4fdad5e", "1d313af"],
  },
  {
    id: "real-hotel-connectivity",
    date: "2026-09-17",
    title: "A real hotel's bookings, and everything that hid behind them",
    summary: "Channex now calls us rather than being polled 288 times a day, and what it did with a push is read back instead of assumed. A booking that could not be imported raises mail instead of silence, a cancellation releases the room on every path there is, and a property that no longer exists stops reporting success every five minutes.",
    kind: "reliability",
    evidence: ["cd807a0", "64c3b65", "e851985", "192e782"],
  },
  {
    id: "outside-numbers",
    date: "2026-09-22",
    title: "The numbers that decide things are in one place",
    summary: "Google Analytics and Search Console answer into the console, so the website's traffic, queries and calls to action are read beside the platform's own figures. Product analytics stopped asking only whether anyone was there and started asking whether what a hotel is entitled to is ever opened.",
    kind: "commercial",
    evidence: ["d5398df", "062a21f", "6bea61c"],
  },
  {
    id: "jobs-can-say-they-failed",
    date: "2026-09-22",
    title: "A failed job stops reporting success",
    summary: "A job that threw kept its lease, so every tick for the next quarter of an hour answered ok and did nothing. It also answered a bare 500 with an empty body, so the run log recorded a failure and nothing about it. Both are fixed on all thirteen jobs, and jobs-lint now fails a route that cannot report its own failure.",
    kind: "reliability",
    evidence: ["2472e66", "52c5b3f"],
  },
  {
    id: "races-proven",
    date: "2026-09-23",
    title: "One room, one guest — proven under load, not argued",
    summary: "The front desk could turn one hold into twelve reservations, put twelve guests in one room and take six rooms off sale with one broken unit. Each is now a row lock or a conditional write, each has a race harness that runs in CI, and a harness that could not fail was rewritten until it could.",
    kind: "reliability",
    evidence: ["b615ad9", "66d98f0", "af61dba", "afaf897"],
  },
  {
    id: "production-read-back",
    date: "2026-09-23",
    title: "Production Channex read back for the first time",
    summary: "Reading a real hotel's live channel found that the Verify button had never once completed, that one closed rate plan could take a whole room off every OTA, and that the calendar and the front desk said 'no price' about nights the channel was selling. The calendar, the quote and the check now all run the resolver the push runs, and each channel card says which step the hotel is on.",
    kind: "reliability",
    evidence: ["2463c18", "f43f3a3", "2c51d6d"],
  },
] as const satisfies readonly PlatformMilestone[];

/**
 * Priority is a launch decision; effort is engineering shape, not a deadline.
 * Now is deliberately small enough to finish. Adding a new Now item requires moving another out.
 */
export const PLATFORM_ROADMAP = [
  {
    id: "real-hotel-channex",
    horizon: "now",
    priority: "must",
    effort: "L",
    owner: "Engineering",
    title: "Real-hotel Channex rehearsal",
    outcome: "One production property completes connect, map, push, book, modify, cancel, retry and disconnect with recorded evidence.",
    dependency: "Sandbox lifecycle and a read-only production check are done (2026-09-23). A real booking on the live property waits on the hotel lifting a stop-sell it set on every plan until March 2027",
  },
  {
    id: "vat-invoicing-signoff",
    horizon: "now",
    priority: "must",
    effort: "S",
    owner: "Founder + external",
    title: "VAT and invoicing sign-off",
    outcome: "An accountant confirms VAT treatment, reverse-charge handling and number-series policy before the first customer invoice is sent.",
    dependency: "Professional confirmation; Revio deliberately does not drive fiscal devices or operate as SUPTO",
  },
  {
    id: "staging-capacity",
    horizon: "now",
    priority: "must",
    effort: "M",
    owner: "Operations",
    title: "Staging and capacity guardrails",
    outcome: "Every release rehearses away from customers; Railway warns before spend can stop the database.",
  },
  {
    id: "trust-truth",
    horizon: "now",
    priority: "must",
    effort: "S",
    owner: "Engineering",
    title: "Trust claims match the controls",
    outcome: "Security headers, security.txt, DPA capabilities and comparison copy are verified against the live platform.",
  },
  {
    id: "live-card-payments",
    horizon: "now",
    priority: "must",
    effort: "S",
    owner: "Founder + external",
    title: "A guest can pay by card",
    outcome: "RevioDirect can take a real card, so a hotel's own booking page stops being the only channel that cannot collect.",
    dependency: "Charging OUR clients is already possible — a live key is stored, tested, BG/EUR, charges enabled; the console is set to sandbox by deliberate choice. What is missing is apps/booking, which carries no Stripe variables at all",
  },
  {
    id: "nightly-read-back",
    horizon: "now",
    priority: "must",
    effort: "M",
    owner: "Engineering",
    title: "Every live channel is read back every night",
    outcome: "What each OTA is actually offering — prices, room counts, then restrictions — is compared with what Revio sends, and a difference reaches a person before a guest books at it.",
    dependency: "The check exists (Verify and channex:readback, read-only). What is missing is running it on a schedule and routing a mismatch to an alert",
  },
  {
    id: "incident-operations",
    horizon: "now",
    priority: "must",
    effort: "S",
    owner: "Operations",
    title: "Critical support and incident ownership",
    outcome: "A hotel knows who responds, operators know the escalation path, and customers can see current incidents.",
  },
  {
    id: "integration-surface",
    horizon: "next",
    priority: "should",
    effort: "XL",
    owner: "Engineering",
    title: "Scoped API and signed webhooks",
    outcome: "Accounting, locks and customer-owned tools can react to stable events without direct database access.",
    dependency: "Versioning, OAuth scopes, idempotency and delivery retries",
  },
  {
    id: "accounting-export",
    horizon: "next",
    priority: "should",
    effort: "M",
    owner: "Engineering",
    title: "Accounting handoff",
    outcome: "Revenue, VAT, payments and issued documents leave Revio in a stable accountant-ready format.",
    dependency: "Confirmed fiscal and VAT treatment",
  },
  {
    id: "booking-localization",
    horizon: "next",
    priority: "should",
    effort: "L",
    owner: "Engineering",
    title: "RevioDirect localization and conversion",
    outcome: "Guest UI languages, conversion funnel, promotions and payment state make direct booking commercially measurable.",
  },
  {
    id: "staff-language",
    horizon: "next",
    priority: "should",
    effort: "XL",
    owner: "Engineering",
    title: "The staff products in the hotel's own language",
    outcome: "A receptionist, a housekeeper and an owner use RevioLink, RevioCRS and RevioPMS in Bulgarian, with the terminology the founder set rather than a translation of it.",
    dependency: "The marketing site is bilingual and the products are not, which is the wrong way round: the site is read once and the products are used every shift. Distinct from RevioDirect localization, which is guest-facing",
  },
  {
    id: "enterprise-identity",
    horizon: "next",
    priority: "should",
    effort: "L",
    owner: "Engineering",
    title: "SSO and lifecycle provisioning",
    outcome: "Small groups can centrally grant and revoke access through OIDC/SAML and SCIM.",
    dependency: "A real group procurement requirement",
  },
  {
    id: "group-business",
    horizon: "next",
    priority: "should",
    effort: "XL",
    owner: "Engineering",
    title: "Groups and corporate business",
    outcome: "Room blocks, release dates, negotiated rates and consolidated billing stop larger properties needing a second system.",
    dependency: "Validated demand from target properties",
  },
  {
    id: "guest-self-service",
    horizon: "later",
    priority: "could",
    effort: "XL",
    owner: "Engineering",
    title: "Guest self-service journey",
    outcome: "Pre-arrival details, online check-in, upsells, payment requests and checkout reduce front-desk work.",
  },
  {
    id: "second-market",
    horizon: "later",
    priority: "could",
    effort: "XL",
    owner: "Founder + external",
    title: "A second country",
    outcome: "One more jurisdiction is onboarded without forking anything: its tax treatment, its invoice series rules and its registry obligations arrive as a pack, the way Bulgaria's did.",
    dependency: "Proven by the first market. The jurisdiction pack exists and has been used exactly once, which is not yet evidence that it generalises",
  },
  {
    id: "revenue-guidance",
    horizon: "later",
    priority: "could",
    effort: "XL",
    owner: "Engineering",
    title: "Revenue recommendations",
    outcome: "Demand and channel economics produce explainable pricing suggestions before any automatic write is allowed.",
  },
  {
    id: "safe-assistant",
    horizon: "later",
    priority: "could",
    effort: "XL",
    owner: "Engineering",
    title: "Approval-gated platform assistant",
    outcome: "The assistant starts read-only, inherits capabilities and records every approved action in the audit trail.",
    dependency: "Stable authorization, API boundaries and human approval controls",
  },
  {
    id: "metasearch",
    horizon: "later",
    priority: "could",
    effort: "L",
    owner: "Founder + external",
    title: "Metasearch distribution",
    outcome: "RevioDirect can acquire demand through Google Hotel Ads and similar channels with attributable economics.",
    dependency: "Partner approval and a proven direct-booking funnel",
  },
] as const satisfies readonly PlatformInitiative[];

export function initiativesFor(horizon: RoadmapHorizon): PlatformInitiative[] {
  return PLATFORM_ROADMAP.filter((item) => item.horizon === horizon);
}

export function milestoneYears(): number[] {
  return [...new Set(PLATFORM_MILESTONES.map((item) => Number(item.date.slice(0, 4))))].sort((a, b) => a - b);
}
