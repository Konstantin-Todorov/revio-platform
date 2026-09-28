import {
  ACCOUNT_TYPE_BY_KEY, defaultBillingFor, isAccountType, isBillingMode, isOurs, nextStatuses, statusView,
  type AccountType, type BillingMode, type LifecycleAction,
} from "@revio/core";
import { forSystem, withSystemTransaction } from "./rls.js";

/**
 * Every change the operator makes to a client's type, status or billing — and the record of it.
 *
 * ## Why one module
 *
 * On 2026-09-26 a real hotel's three products were switched off in two seconds and the account was
 * suspended, and afterwards nobody could say who had done it or why: suspension wrote nothing at
 * all. Each write here changes the tenant AND appends a `ClientEvent` in one transaction, so a
 * change without a record, or a record of a change that did not happen, cannot exist.
 *
 * The rules — which status may follow which, what a type bills by default — are `@revio/core`'s
 * (`client-lifecycle.ts`). This only applies them.
 */

export interface Actor {
  id: string | null;
  name: string;
}

export type LifecycleResult = { ok: true; message: string } | { ok: false; message: string };

const TYPE_LABEL = (t: string) => (isAccountType(t) ? ACCOUNT_TYPE_BY_KEY[t].label : t);
const BILLING_LABEL: Record<BillingMode, string> = { paying: "Paying", free: "Free", none: "Not billed" };
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Append one line to a client's history. Exported for product changes, which live in the console. */
export async function recordClientEvent(e: {
  tenantId: string;
  kind: "type" | "status" | "billing" | "product" | "created";
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
  actor: Actor;
}): Promise<void> {
  await forSystem().clientEvent.create({
    data: {
      tenantId: e.tenantId, kind: e.kind, fromValue: e.fromValue ?? null, toValue: e.toValue ?? null,
      reason: e.reason?.trim() || null, actorId: e.actor.id, actorName: e.actor.name,
    },
  });
}

/**
 * Suspend, reinstate, close or reopen.
 *
 * ⚠️ Products are NOT touched, on purpose. "Stop this hotel" used to be done by switching each
 * product off, so reinstating meant remembering which three to switch back on. The status alone
 * decides whether anybody can sign in — every app already refuses a tenant that is not `active` —
 * so undoing a suspension is one step that restores exactly what was there.
 *
 * Closing also ends any running trial (a clock on an account nobody can open) and removes unsent
 * drafts; sent and paid invoices are never touched.
 */
export async function changeClientStatus(args: {
  tenantId: string;
  action: LifecycleAction;
  reason: string | null;
  actor: Actor;
}): Promise<LifecycleResult> {
  const db = forSystem();
  const tenant = await db.tenant.findUnique({ where: { id: args.tenantId }, select: { id: true, name: true, status: true } });
  if (!tenant) return { ok: false, message: "That client no longer exists — it may have been deleted. Go back to the client list." };

  const step = nextStatuses(tenant.status).find((n) => n.action === args.action);
  if (!step) {
    return {
      ok: false,
      message: `${tenant.name} is ${statusView(tenant.status, null).label.toLowerCase()}, so it cannot be ${pastTense(args.action)}. Reload the page to see where it stands.`,
    };
  }
  const reason = args.reason?.trim() ?? "";
  if ((args.action === "suspend" || args.action === "close") && !reason) {
    return { ok: false, message: `Say why ${tenant.name} is being ${pastTense(args.action)} — it is the first thing anybody will ask later.` };
  }

  const now = new Date();
  await withSystemTransaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        status: step.to,
        statusReason: reason || null,
        statusChangedAt: now,
        ...(args.action === "close" ? { closedAt: now } : {}),
        ...(args.action === "reopen" ? { closedAt: null } : {}),
      },
    });
    if (args.action === "close") {
      const running = await tx.productTrial.findMany({ where: { tenantId: tenant.id, endedAt: null }, select: { id: true, product: true } });
      for (const t of running) {
        await tx.productTrial.update({ where: { id: t.id }, data: { endedAt: now, outcome: "cancelled" } });
        const field = t.product === "cm" ? "hasChannelManager" : t.product === "crs" ? "hasReservation" : "hasPms";
        await tx.tenant.update({ where: { id: tenant.id }, data: { [field]: false } });
      }
      await tx.invoice.deleteMany({ where: { tenantId: tenant.id, status: "draft", number: null } });
    }
    await tx.clientEvent.create({
      data: {
        tenantId: tenant.id, kind: "status", fromValue: tenant.status, toValue: step.to,
        reason: reason || null, actorId: args.actor.id, actorName: args.actor.name,
      },
    });
  });

  const said: Record<LifecycleAction, string> = {
    suspend: `${tenant.name} is suspended. Nobody there can sign in; nothing is deleted, and Reinstate brings everything back as it was.`,
    reinstate: `${tenant.name} is active again — every product and setting exactly as before.`,
    close: `${tenant.name} is closed. Sign-in is blocked and the data is kept for 90 days; it can be reopened until then.`,
    reopen: `${tenant.name} is open again.`,
  };
  return { ok: true, message: said[args.action] };
}

function pastTense(a: LifecycleAction): string {
  return a === "suspend" ? "suspended" : a === "reinstate" ? "reinstated" : a === "close" ? "closed" : "reopened";
}

/**
 * Change what kind of account this is. Billing moves to the new type's default at the same time —
 * a client made a pilot starts free, one made a test account stops being billed — and both changes
 * are recorded, so the billing never changes without a line saying why.
 */
export async function changeClientType(args: {
  tenantId: string;
  type: string;
  reason: string | null;
  freeUntil?: Date | null;
  actor: Actor;
}): Promise<LifecycleResult> {
  if (!isAccountType(args.type)) return { ok: false, message: "Choose one of the four account types." };
  const type: AccountType = args.type;
  const reason = args.reason?.trim() ?? "";
  if (!reason) return { ok: false, message: "Say why the account type is changing — it decides whether they are billed and counted." };

  const db = forSystem();
  const tenant = await db.tenant.findUnique({
    where: { id: args.tenantId },
    select: { id: true, name: true, accountType: true, billingMode: true, freeUntil: true },
  });
  if (!tenant) return { ok: false, message: "That client no longer exists — it may have been deleted. Go back to the client list." };
  if (tenant.accountType === type) return { ok: true, message: `${tenant.name} is already ${TYPE_LABEL(type).toLowerCase()}.` };

  const billing = defaultBillingFor(type);
  const freeUntil = billing === "free" ? args.freeUntil ?? null : null;
  await withSystemTransaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { accountType: type, isDemo: isOurs(type), billingMode: billing, freeUntil },
    });
    await tx.clientEvent.create({
      data: {
        tenantId: tenant.id, kind: "type", fromValue: TYPE_LABEL(tenant.accountType), toValue: TYPE_LABEL(type),
        reason, actorId: args.actor.id, actorName: args.actor.name,
      },
    });
    const before = describeBilling(tenant.billingMode, tenant.freeUntil);
    const after = describeBilling(billing, freeUntil);
    if (before !== after) {
      await tx.clientEvent.create({
        data: {
          tenantId: tenant.id, kind: "billing", fromValue: before, toValue: after,
          reason: `Follows the account type (${TYPE_LABEL(type)})`, actorId: args.actor.id, actorName: args.actor.name,
        },
      });
    }
    if (billing !== "paying") await tx.invoice.deleteMany({ where: { tenantId: tenant.id, status: "draft", number: null } });
  });
  return { ok: true, message: `${tenant.name} is now ${TYPE_LABEL(type).toLowerCase()} · ${describeBilling(billing, freeUntil).toLowerCase()}.` };
}

export function describeBilling(mode: string, freeUntil: Date | null): string {
  if (mode === "free") return freeUntil ? `Free until ${day(freeUntil)}` : "Free, no end date";
  return isBillingMode(mode) ? BILLING_LABEL[mode] : mode;
}

/** Paying, free until a date, or not billed. Unsent drafts go the moment a client stops paying. */
export async function changeClientBilling(args: {
  tenantId: string;
  mode: string;
  freeUntil: Date | null;
  note: string | null;
  actor: Actor;
}): Promise<LifecycleResult> {
  if (!isBillingMode(args.mode)) return { ok: false, message: "Choose paying, free until a date, or not billed." };
  const mode: BillingMode = args.mode;
  if (mode === "free" && !args.freeUntil) {
    return { ok: false, message: "Give the date the free period ends — a free period with no end is one nobody remembers to stop." };
  }
  const note = args.note?.trim() ?? "";
  if (!note) return { ok: false, message: "Say why — who agreed it and on what terms. It is what finance will ask." };

  const db = forSystem();
  const tenant = await db.tenant.findUnique({ where: { id: args.tenantId }, select: { id: true, name: true, billingMode: true, freeUntil: true } });
  if (!tenant) return { ok: false, message: "That client no longer exists — it may have been deleted. Go back to the client list." };

  const freeUntil = mode === "free" ? args.freeUntil : null;
  // A new end date in the past is a mistake, not a decision: to bill from now, choose Paying.
  const startOfToday = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  if (freeUntil && freeUntil < startOfToday && freeUntil.getTime() !== tenant.freeUntil?.getTime()) {
    return { ok: false, message: "That date has already passed. A free period ends in the future — to start billing now, choose Paying." };
  }
  await withSystemTransaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenant.id }, data: { billingMode: mode, freeUntil, billingNote: note } });
    await tx.clientEvent.create({
      data: {
        tenantId: tenant.id, kind: "billing",
        fromValue: describeBilling(tenant.billingMode, tenant.freeUntil), toValue: describeBilling(mode, freeUntil),
        reason: note, actorId: args.actor.id, actorName: args.actor.name,
      },
    });
    if (mode !== "paying") await tx.invoice.deleteMany({ where: { tenantId: tenant.id, status: "draft", number: null } });
  });
  return { ok: true, message: `${tenant.name}: ${describeBilling(mode, freeUntil).toLowerCase()}.` };
}
