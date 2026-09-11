import { prisma } from "./client.js";
import { withSystemTransaction } from "./rls.js";
import {
  PRODUCT_BY_KEY,
  TRIAL_DAYS,
  canSelfStartTrial,
  trialEndsAt,
  type ProductKey,
  type SelfTrialVerdict,
} from "@revio/core";

/**
 * A hotel starting its own trial — the one place a hotel session may change an entitlement.
 *
 * ## ⚠️ Why this needs the system perimeter, and why that is safe here
 *
 * Entitlements are **operator business data**. A hotel that could write its own
 * `Tenant.hasPms` would hold the licence model in its own hands, so hotel apps run under
 * `forTenant()` and cannot touch it — correctly.
 *
 * This function is the deliberate, single exception, and it is narrow in every direction that
 * matters:
 *
 * - it acts **only on the tenant id it is given**, which the caller takes from the session and never
 *   from a form field;
 * - it can only ever turn a product **ON**, never off, and never any other column;
 * - it refuses unless `canSelfStartTrial` — pure, tested, in `@revio/core` — says yes;
 * - it always writes a `ProductTrial` alongside, so the entitlement it grants **has an expiry from
 *   the moment it exists**. There is no path here that leaves a product on with nothing to end it.
 *
 * The alternative shapes are worse rather than safer. A hotel-app HTTP call to the operator console
 * needs a shared secret in three more services and turns one transaction into two systems. Letting
 * apps reach for `forSystem()` directly is the thing this function exists to prevent: the perimeter
 * rule stops being a rule the moment it has a general-purpose escape hatch.
 *
 * ## Both writes commit together, or neither does
 *
 * An entitlement switched on without its trial row is a product that never expires — free forever,
 * invisibly. A trial row without the entitlement is a clock on something the hotel cannot open. The
 * sweep's own expiry was split across two commits once and stranded access ON when the second failed
 * (`trial-sweep.ts`, 2026-09-09); this is the same lesson applied at the other end.
 */
export interface SelfStartResult {
  ok: boolean;
  /** Why not, in words meant for the hotel. Present whenever `ok` is false. */
  message?: string;
  trial?: { id: string; endsAt: Date };
}

export async function selfStartTrial(args: {
  /** From the session. NEVER from a form field. */
  tenantId: string;
  product: ProductKey;
  /** Their role, from the session — the rule refuses anyone who cannot commit the account. */
  role: string;
  /** Who pressed it, for the record. A trial with nobody's name on it is not a decision. */
  userId: string;
}): Promise<SelfStartResult> {
  if (!PRODUCT_BY_KEY[args.product]) return { ok: false, message: "Unknown product." };

  const tenant = await prisma.tenant.findUnique({
    where: { id: args.tenantId },
    select: {
      id: true, status: true,
      hasChannelManager: true, hasReservation: true, hasPms: true,
      // EVERY trial, finished ones included — "one per product ever" cannot be checked from the
      // running ones alone, and that is the loophole the rule exists to close.
      productTrials: { select: { product: true } },
    },
  });
  if (!tenant) return { ok: false, message: "That account no longer exists." };

  const verdict: SelfTrialVerdict = canSelfStartTrial({
    product: args.product,
    owns: { cm: tenant.hasChannelManager, crs: tenant.hasReservation, pms: tenant.hasPms },
    everTrialled: tenant.productTrials.map((t) => t.product as ProductKey),
    tenantStatus: tenant.status,
    role: args.role,
  });
  if (!verdict.ok) return { ok: false, ...(verdict.message ? { message: verdict.message } : {}) };

  const FIELD: Record<ProductKey, "hasChannelManager" | "hasReservation" | "hasPms"> = {
    cm: "hasChannelManager", crs: "hasReservation", pms: "hasPms",
  };
  const startedAt = new Date();
  const endsAt = trialEndsAt(startedAt, TRIAL_DAYS);

  try {
    const trial = await withSystemTransaction(async (tx) => {
      const created = await tx.productTrial.create({
        data: {
          tenantId: tenant.id,
          product: args.product,
          startedAt,
          endsAt,
          grantedById: args.userId,
        },
        select: { id: true, endsAt: true },
      });
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { [FIELD[args.product]]: true },
      });
      return created;
    });
    return { ok: true, trial };
  } catch {
    /*
     * The partial unique index is the last word, and it is reached when two people press the button
     * in the same second. The rule above already refused a second trial; this is the database saying
     * so when two requests both passed that check before either had written.
     */
    return {
      ok: false,
      message: "A trial of this product is already running — reload the page and it will be there.",
    };
  }
}

/**
 * The hotel's own running trial of one product, for the strip at the top of that product.
 *
 * ## ⚠️ A second deliberate crossing of the operator perimeter, and why it is narrower than it looks
 *
 * `ProductTrial` carries the `operator_only` policy, so a hotel session cannot read it. That was
 * right when a trial was purely our commercial arrangement *about* a hotel — and it is why this
 * function exists rather than the policy being widened. **Widening it would expose every trial
 * column to every hotel query forever**, including `outcome`, `grantedById` and the reminder
 * timestamps, to fix one banner.
 *
 * Instead: one function, one tenant, one product, and a `select` that returns only the three facts
 * the strip needs. It reads nothing about any other hotel and writes nothing at all.
 *
 * `endedAt: null` is part of the question, not a filter on the answer: a finished trial must produce
 * no banner, and asking the database for "the running one" is the only way that cannot be got wrong
 * by a caller who forgets.
 */
export async function runningTrialFor(
  tenantId: string,
  product: ProductKey,
): Promise<{ id: string; startedAt: Date; endsAt: Date; keepRequestedAt: Date | null } | null> {
  return prisma.productTrial.findFirst({
    where: { tenantId, product, endedAt: null },
    select: { id: true, startedAt: true, endsAt: true, keepRequestedAt: true },
    // The partial unique index allows only one, but ordering makes the answer deterministic even if
    // that index were ever dropped — a banner that changes its end date between reloads is a bug
    // nobody would think to look for here.
    orderBy: { startedAt: "desc" },
  });
}

/**
 * The hotel says they want to keep it.
 *
 * ## What this deliberately does NOT do
 *
 * It does not convert the trial, extend it, or touch the entitlement. `@revio/core`'s trials module
 * states the rule this protects: **a trial must never become a charge on its own.** Somebody
 * pressing a button in their own product is not agreement to a price nobody has quoted them yet.
 * So this records the intent and stops — the operator converts it on the client page, after the
 * conversation about what it costs.
 *
 * ## Why it is idempotent
 *
 * `keepRequestedAt: null` in the `where` clause means a second press changes nothing and the first
 * timestamp survives. The date this was asked is the one that matters to a call-back; overwriting it
 * on every press would make an old request look like it arrived this morning. Same shape as the
 * webhook settlement and the R1 hold conversion: the `where` clause is the decision.
 */
export async function requestKeepTrial(args: {
  tenantId: string;
  product: ProductKey;
  userId: string;
}): Promise<{ ok: boolean; alreadyAsked: boolean }> {
  const trial = await runningTrialFor(args.tenantId, args.product);
  if (!trial) return { ok: false, alreadyAsked: false };
  if (trial.keepRequestedAt) return { ok: true, alreadyAsked: true };

  const { count } = await prisma.productTrial.updateMany({
    where: { id: trial.id, tenantId: args.tenantId, endedAt: null, keepRequestedAt: null },
    data: { keepRequestedAt: new Date(), keepRequestedById: args.userId },
  });
  // count === 0 means somebody else pressed it first, between the read and the write. That is the
  // same outcome for this customer, so it is reported as already asked rather than as a failure.
  return { ok: true, alreadyAsked: count === 0 };
}
