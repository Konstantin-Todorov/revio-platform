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

  const owner = tenant.users[0];
  if (owner?.email) {
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
    await sendEmail({
      to: [owner.email],
      subject: `${info.name} is switched on for ${TRIAL_DAYS} days`,
      text: renderSystemEmailText(mail),
      html: renderSystemEmail(mail),
    }).catch(() => { /* access is already correct; the mail is the softer half */ });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${tenantId}`);
  return setFlash("success", `${info.name} on trial for ${tenant.name} until ${endsAt.toISOString().slice(0, 10)}.`);
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

  revalidatePath("/clients");
  revalidatePath(`/clients/${trial.tenantId}`);
  return setFlash(
    "success",
    outcome === "converted"
      ? "Kept. It is now a normal product on their account and will be invoiced."
      : "Trial stopped and access removed. Nothing was deleted.",
  );
}
