/**
 * A client of ours, as four separate facts — and what may happen to it next.
 *
 * ## Why four facts and not one status
 *
 * Until 2026-09-28 the console answered four different questions with one `status` column, one
 * `isDemo` flag and three product switches in a list row: *what kind of account is this*, *can they
 * use it*, *do they pay*, and *is it working*. So "stop this hotel" was done by switching its
 * products off (one click each, no reason, no record), a demo hotel could not be removed because its
 * test invoices were treated as tax records, and the real hotel we were piloting with got invoice
 * drafts like any paying client.
 *
 * The shape is borrowed from tools that have done this for years: Shopify separates the KIND of
 * store (development / client transfer / live) from its state; Stripe separates test from live
 * entirely; SiteMinder runs a pilot as a real property whose billing is a separate decision; GitLab
 * and Atlassian make deactivation reversible and deletion a separate, later step.
 *
 * - **Type** — `live` · `pilot` · `demo` · `test`. Chosen deliberately, never toggled by accident.
 * - **Status** — `Tenant.status`, the one thing every app reads to let a hotel in:
 *   `active` · `suspended` · `closed` (and `pending_signup` before a signup is confirmed).
 * - **Billing** — `paying` · `free` (until a date) · `none`. Only this decides whether we invoice.
 * - **Health** — computed from sync and setup, never stored, never edited (see `attention.ts`).
 */

export type AccountType = "live" | "pilot" | "demo" | "test";
export type BillingMode = "paying" | "free" | "none";
export type ClientStatus = "active" | "suspended" | "closed" | "pending_signup";

export const ACCOUNT_TYPES: readonly { key: AccountType; label: string; blurb: string }[] = [
  { key: "live", label: "Live client", blurb: "A hotel that uses Revio for real and is billed for it." },
  { key: "pilot", label: "Pilot", blurb: "A real hotel we are trialling with in production. Real data, billed only if you say so." },
  { key: "demo", label: "Demo", blurb: "Ours, for sales demos. Refreshed with sample stays every night; never counted as business." },
  { key: "test", label: "Test", blurb: "Ours, for testing. Never billed or counted; can be removed at any time." },
] as const;

export const ACCOUNT_TYPE_BY_KEY: Record<AccountType, (typeof ACCOUNT_TYPES)[number]> = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.key, t]),
) as Record<AccountType, (typeof ACCOUNT_TYPES)[number]>;

export function isAccountType(v: unknown): v is AccountType {
  return v === "live" || v === "pilot" || v === "demo" || v === "test";
}
export function isBillingMode(v: unknown): v is BillingMode {
  return v === "paying" || v === "free" || v === "none";
}

/**
 * Ours rather than a customer's — left out of MRR, revenue, renewals and the attention feed.
 *
 * This is what `Tenant.isDemo` has always meant to the console ("ours, for testing"), so the column
 * is kept and written from the type on every change: 29 call sites keep working and cannot drift.
 * The two places that need a SALES demo specifically — the nightly sample stays and the refusal to
 * provision a real Channex property — read the type, because a test account is neither.
 */
export function isOurs(type: AccountType): boolean {
  return type === "demo" || type === "test";
}

/** What billing a type starts on. A pilot is free by default; ours are never billed. */
export function defaultBillingFor(type: AccountType): BillingMode {
  if (type === "live") return "paying";
  if (type === "pilot") return "free";
  return "none";
}

/** Days a closed client's data is kept, reopenable, before it may be deleted. Founder, 2026-09-28. */
export const RETENTION_DAYS = 90;

export function retentionEndsAt(closedAt: Date): Date {
  return new Date(closedAt.getTime() + RETENTION_DAYS * 86_400_000);
}

/**
 * Whether we invoice this client for a billing period.
 *
 * `free` ends on its date: a period is billed only when it STARTS on or after it, so a pilot free
 * "until 28 December" is not billed for December and is billed for January. Pro-rating a partial
 * month would be a price nobody quoted.
 *
 * Demo and test accounts may still be set to `paying` on purpose — that is how the billing flow is
 * rehearsed end to end — and their invoices then carry the `DEMO-` series, never a tax number.
 */
export function isBillable(
  c: { accountType: AccountType; billingMode: BillingMode; freeUntil: Date | null; status: string },
  periodStart: Date,
): boolean {
  if (c.status !== "active") return false;
  if (c.billingMode === "none") return false;
  if (c.billingMode === "paying") return true;
  // free
  return c.freeUntil !== null && periodStart.getTime() >= c.freeUntil.getTime();
}

/** The status, in the operator's words, with the tone it deserves. */
export function statusView(
  status: string,
  closedAt: Date | null,
): { label: string; tone: "success" | "warning" | "danger" | "neutral"; detail?: string } {
  if (status === "active") return { label: "Active", tone: "success" };
  if (status === "suspended") return { label: "Suspended", tone: "warning", detail: "Sign-in blocked. Nothing is deleted; reinstating restores everything." };
  if (status === "closed") {
    const until = closedAt ? retentionEndsAt(closedAt) : null;
    return {
      label: "Closed",
      tone: "danger",
      detail: until ? `Data kept until ${until.toISOString().slice(0, 10)}; can be reopened until then.` : "Data kept; can be reopened.",
    };
  }
  if (status === "pending_signup") return { label: "Awaiting confirmation", tone: "neutral", detail: "Signed up; has not opened the confirmation email yet." };
  return { label: status, tone: "neutral" };
}

export type LifecycleAction = "suspend" | "reinstate" | "close" | "reopen";

/**
 * What the status may move to from here. Deletion is not in this list: it has its own rule
 * (`canDeleteClient`) because it depends on the data, not only on the status.
 */
export function nextStatuses(status: string): { action: LifecycleAction; to: ClientStatus }[] {
  if (status === "active") return [{ action: "suspend", to: "suspended" }, { action: "close", to: "closed" }];
  if (status === "suspended") return [{ action: "reinstate", to: "active" }, { action: "close", to: "closed" }];
  if (status === "closed") return [{ action: "reopen", to: "active" }];
  return [];
}

/** Why a status change needs a reason, and the reasons offered first. */
export const SUSPEND_REASONS = ["Not paying", "Client asked to pause", "Security concern", "Other"] as const;
export const CLOSE_REASONS = ["Contract ended", "Client left", "Never went live", "Other"] as const;
