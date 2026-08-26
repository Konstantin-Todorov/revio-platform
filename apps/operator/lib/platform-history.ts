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
    dependency: "Hotel OTA credentials and channel approval",
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
    id: "hotel-admin-mfa",
    horizon: "now",
    priority: "must",
    effort: "M",
    owner: "Engineering",
    title: "MFA for hotel administrators",
    outcome: "Owners and administrators can protect the accounts that control rates, guest data and staff access.",
    dependency: "Reuse the proven Operator TOTP primitives without sharing app internals",
  },
  {
    id: "guest-rights",
    horizon: "now",
    priority: "must",
    effort: "M",
    owner: "Engineering",
    title: "Guest data-rights workflow",
    outcome: "Export, correction and erasure/anonymisation are real operations with legal-retention exceptions and an audit trail.",
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
