"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import {
  PRODUCT_BY_KEY,
  TRIAL_DAYS,
  renderSystemEmail,
  renderSystemEmailText,
  trialEndsAt,
  type ProductKey,
} from "@revio/core";
import { sendEmail } from "@revio/email";
import { originFor } from "./product-origins";
import { getOperatorSession } from "./session";

const FIELD: Record<ProductKey, "hasChannelManager" | "hasReservation" | "hasPms"> = {
  cm: "hasChannelManager",
  crs: "hasReservation",
  pms: "hasPms",
};

/**
 * Start a trial: switch the product on, and set the date it stops.
 *
 * ## Why nobody self-serves this
 *
 * There is no "start free trial" button in the hotel's product, deliberately. An operator grants it,
 * which means somebody has decided this hotel should have it and can say so on a call. That is worth
 * more than the friction it costs at our size, and it is the only reason the "no surprise charge"
 * promise is trivially true: nothing can begin without one of us.
 *
 * ## The pitch is true, which is why it is worth making
 *
 * Most SaaS trials are spent importing data, so the evaluation never happens. Ours cannot be: the
 * hotel's rooms, rates and guests are already there because every product shares one core. The email
 * says exactly that.
 */
export async function startTrial(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to start a trial.");

  const tenantId = String(fd.get("tenantId") ?? "");
  const product = String(fd.get("product") ?? "") as ProductKey;
  const info = PRODUCT_BY_KEY[product];
  if (!tenantId || !info) return flashError("Choose a client and a product.");

  const db = forSystem();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, hasChannelManager: true, hasReservation: true, hasPms: true,
      users: { where: { role: "owner", active: true }, take: 1, select: { name: true, email: true } },
    },
  });
  if (!tenant) return flashError("That client no longer exists.");

  if (tenant[FIELD[product]]) {
    return flashError(`${tenant.name} already has ${info.name}. A trial would take it away when it ended.`);
  }

  const existing = await db.productTrial.findFirst({
    where: { tenantId, product, endedAt: null },
    select: { id: true },
  });
  if (existing) return flashError(`${tenant.name} is already trialling ${info.name}.`);

  const now = new Date();
  const endsAt = trialEndsAt(now);

  /*
   * The trial row first, then the entitlement.
   *
   * A failure between them leaves a trial recorded with no access — visible, harmless, and fixed by
   * starting it again. The other order would switch a product on with nothing to ever turn it off,
   * which is a free product nobody notices.
   */
  await db.productTrial.create({
    data: { tenantId, product, startedAt: now, endsAt, grantedById: session.userId },
  });
  await db.tenant.update({ where: { id: tenantId }, data: { [FIELD[product]]: true } });

  /*
   * ⚠️ Everything past this point runs AFTER the trial is granted and committed, so nothing here
   * may be allowed to lose the confirmation or the refresh.
   *
   * It used to `await sendEmail(...).catch(…)` with only the send itself guarded — building the
   * message was not — and the transport had no timeout at all. A stalled provider connection
   * therefore held this action open indefinitely with the trial already in the database and not one
   * pixel changed on screen. That is exactly what was reported on 2026-09-11: press it, nothing
   * happens, reload and the trial is there.
   *
   * Two changes, and both are needed. `@revio/email` now bounds the wait. This block cannot throw.
   * And the result is carried into the flash, because "we could not tell the customer" is something
   * the operator has to know — silently swallowing it means a hotel gets a product switched on with
   * no idea it is running or when it stops.
   */
  const owner = tenant.users[0];
  const told = await notifyOwner(owner, product, endsAt);

  revalidatePath("/clients", "layout");
  revalidatePath(`/clients/${tenantId}`, "layout");
  return setFlash(
    told === "failed" ? "info" : "success",
    `${info.name} on trial for ${tenant.name} until ${endsAt.toISOString().slice(0, 10)}.${TOLD_SUFFIX[told]}`,
  );
}

/** What happened to the "your trial has started" email, in words the flash can use. */
const TOLD_SUFFIX: Record<TellOutcome, string> = {
  sent: " The owner has been emailed.",
  // Not an error — the trial is correct and running. It is a job left for a human.
  failed: " We could not email the owner, so tell them yourself — they do not know it is on.",
  no_recipient: " There is no active owner with an email on this account, so nobody has been told.",
};

type TellOutcome = "sent" | "failed" | "no_recipient";

/**
 * Tell the owner their trial has started. Never throws, and never leaves the caller not knowing.
 *
 * The pitch is in the second paragraph and it is the real one: most SaaS trials are spent importing
 * data, so the evaluation never happens. Ours cannot be — the hotel's rooms, rates and guests are
 * already there because every product shares one core.
 */
async function notifyOwner(
  owner: { name: string | null; email: string | null } | undefined,
  product: ProductKey,
  endsAt: Date,
): Promise<TellOutcome> {
  const info = PRODUCT_BY_KEY[product];
  if (!owner?.email || !info) return "no_recipient";
  try {
    const mail = {
      preview: `${info.name} is on for the next ${TRIAL_DAYS} days.`,
      heading: `${info.name} is switched on for ${TRIAL_DAYS} days`,
      product: info.name,
      blocks: [
        { p: `${info.name} is now on your existing Revio login — ${info.tagline.toLowerCase()}.` },
        {
          p: "There is nothing to import and nothing to set up. Your rooms, rates and guests are already there, because every Revio product shares one system — so you can judge it on your own hotel from the first minute rather than spending the trial on data entry.",
        },
        { action: { label: `Open ${info.name}`, url: originFor(product) } },
        { p: `The trial runs until ${endsAt.toISOString().slice(0, 10)}. We will remind you a week before and again the day before.` },
        {
          note: "Nothing starts automatically and you will not be charged. If you do nothing it simply switches off, and nothing is deleted — your data is shared with the products you already use.",
        },
      ],
    };
    const res = await sendEmail({
      to: [owner.email],
      subject: `${info.name} is switched on for ${TRIAL_DAYS} days`,
      text: renderSystemEmailText(mail),
      html: renderSystemEmail(mail),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    // Rendering the message, resolving an origin, anything. The trial stands either way.
    return "failed";
  }
}

/**
 * End a trial early — either because they are keeping it, or because they are not.
 *
 * **Keeping it is the only path from trial to paid, and it is this button.** No clock, no email and
 * no sweep can do it: a customer who finds a subscription they did not agree to will not stay one.
 */
export async function endTrial(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change a trial.");

  const id = String(fd.get("id") ?? "");
  const outcome = String(fd.get("outcome") ?? "");
  if (!id || (outcome !== "converted" && outcome !== "cancelled")) {
    return flashError("Say whether they kept it or not.");
  }

  const db = forSystem();
  const trial = await db.productTrial.findUnique({
    where: { id },
    select: { id: true, tenantId: true, product: true, endedAt: true },
  });
  if (!trial) return flashError("That trial no longer exists.");
  if (trial.endedAt) return flashError("That trial has already finished.");

  await db.productTrial.update({
    where: { id },
    data: { endedAt: new Date(), outcome },
  });

  // Converted keeps the entitlement exactly as it is — it is already on. Cancelled takes it away.
  if (outcome === "cancelled") {
    await db.tenant.update({
      where: { id: trial.tenantId },
      data: { [FIELD[trial.product as ProductKey]]: false },
    });
  }

  /*
   * ⚠️ `"layout"`, not the default `"page"`, and that is load-bearing rather than tidy.
   *
   * `FlashToast` is rendered by `(protected)/layout.tsx`. Revalidating only the page path re-renders
   * the page segment and leaves the cached layout in place — so the message this action just wrote
   * is never drawn, and the screen comes back looking as though the button did nothing. Verified in
   * the browser on 2026-09-11: page-type revalidation updated the content and showed no toast;
   * layout-type showed it.
   */
  revalidatePath("/clients", "layout");
  revalidatePath(`/clients/${trial.tenantId}`, "layout");
  return setFlash(
    "success",
    outcome === "converted"
      ? "Kept. It is now a normal product on their account and will be invoiced."
      : "Trial stopped and access removed. Nothing was deleted.",
  );
}
