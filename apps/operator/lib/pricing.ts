/**
 * The pricing model now lives in `@revio/core` — this file is the operator's door to it.
 *
 * ## Why it moved
 *
 * It was operator-only for as long as we were the only ones allowed to see a price. The founder
 * asked on 2026-09-11 whether the three hotel products should have a billing section of their own —
 * *"дали не трябва и трите софтуера в админ акаунтите да имат билинг част"* — and the answer to
 * that is a second caller. The platform rule is to extract at the moment a second caller appears,
 * never speculatively, and an app may never import another app's internals.
 *
 * It belongs in core on its own merits: it is constants and arithmetic, pure, with no database and
 * no framework. What it must never become is a copy — a hotel reading one monthly figure while the
 * invoice is generated from another is worse than showing them nothing at all.
 *
 * ## Why the shim exists rather than twelve edited imports
 *
 * `Entitlements` and `ProductKey` are the operator's own spellings, and `ProductKey` collides in
 * core with the `"cm" | "crs" | "pms"` key that trials, emails and URLs use. Aliasing here keeps
 * both names true where they are read, and keeps this move to one file instead of twelve.
 *
 * No `import "server-only"` here, deliberately. It was never on the original either: this is
 * constants and arithmetic with no secrets in it, and the hotel apps now render some of these
 * figures on screens of their own.
 */
export * from "@revio/core";

export type { Entitlements } from "@revio/core";
/** The operator's spelling of a product: the entitlement COLUMN, not the short url key. */
export type { BilledProductKey as ProductKey } from "@revio/core";
