/**
 * @revio/booking — the public (guest-facing) booking domain.
 *
 * Lifted out of the CRS when the booking engine became a real product: `apps/booking` and the CRS's
 * own public API routes both need these operations, and an app may never import another app's
 * internals (root CLAUDE.md). Everything here is callable WITHOUT a staff session and is
 * parameterized by a tenant-scoped Prisma client, so the caller owns the perimeter decision.
 */
export * from "./public-engine.js";
export * from "./slug.js";
export * from "./rate-limit.js";
