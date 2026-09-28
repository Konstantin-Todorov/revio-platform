"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { forSystem, issueHandoff, requestKeepTrial, selfStartTrial, type SelfStartResult } from "@revio/db";
import { PRODUCT_BY_KEY, hasFinishedSetup, type ProductKey, type ProductName } from "@revio/core";
import { fill } from "@revio/ui/i18n";
import { productStrings } from "@revio/ui/product-strings";
import { guard } from "./authz";
import { productOrigin } from "@revio/ui/product-links";
import { flashError, setFlash } from "@revio/ui/flash";
import { i18n } from "./i18n/server";
import { common } from "./i18n/common";

/** This file's one-line refusals, in the reader's language. */
async function flashSay() {
  return (await i18n()).t(common).flash;
}

/**
 * Start a trial of another product, from inside this one.
 *
 * ⚠️ **The tenant and the role come from the SESSION, never from the form.** The product key is the
 * only thing the browser supplies, and it is checked against the known list. Taking a tenant id from
 * a form field here would let anybody switch a product on for any hotel.
 *
 * Every rule lives in `selfStartTrial` / `canSelfStartTrial`, so this cannot be more permissive than
 * the shared decision by accident — it is wiring, not policy.
 */
export async function beginSelfTrial(fd: FormData): Promise<void> {
  /*
   * `manageSubscription`, checked HERE rather than only in the page that renders the button.
   * A server action is a POST endpoint: Next runs it before it re-renders, so a hidden button and a
   * layout redirect both fire too late to stop the write. `selfStartTrial` re-checks the same rule
   * on the other side of the perimeter — this refuses early so the person gets a sentence.
   */
  const g = await guard("manageSubscription");
  if (!g.ok) return flashError(g.error);
  const session = g.session;

  const product = String(fd.get("product") ?? "") as ProductKey;
  const info = PRODUCT_BY_KEY[product];
  if (!info) return flashError((await flashSay()).unknownProduct);

  const result = await selfStartTrial({
    tenantId: session.tenantId,
    product,
    role: session.role,
    userId: session.userId,
  });
  if (!result.ok) return flashError(await trialRefusal(result, info.name));

  revalidatePath("/", "layout");
  /*
   * Straight into the product, signed in, and onto its own first-run flow.
   *
   * ⚠️ Through a hand-off, never a bare link to the other origin. Each product has its own session
   * cookie, so `redirect(productOrigin(product))` — what this did until 2026-09-28 — landed the hotel
   * on the new product's SIGN-IN page at the one moment the platform's claim ("one login, nothing
   * to set up twice") is most persuasive. The success sentence was set as a flash on THIS origin, so
   * it never reached them either; the trial strip on the other side already says what they need.
   *
   * `next=welcome` opens the product's first-run flow, which knows what carried over — the property,
   * rooms, prices and branding are shared, so a second product opens on its summary rather than six
   * screens or a dashboard of zeros. Skipped when this product was set up here before.
   */
  const [user, properties] = await Promise.all([
    forSystem().user.findUnique({ where: { id: session.userId }, select: { email: true } }),
    forSystem().property.findMany({ where: { tenantId: session.tenantId }, select: { setupCompleted: true } }),
  ]);
  if (!user) redirect(productOrigin(product));
  const setUp = properties.length > 0 && properties.every((p) => hasFinishedSetup(p.setupCompleted, info.name as ProductName));
  const token = await issueHandoff({ userId: session.userId, email: user.email, product });
  redirect(`${productOrigin(product)}/handoff?t=${encodeURIComponent(token)}${setUp ? "" : "&next=welcome"}`);
}

/** A refused trial, worded for the reader from core's code — `message` is the English fallback. */
async function trialRefusal(result: SelfStartResult, product: string): Promise<string> {
  const s = (await i18n()).t(productStrings).trial;
  if (result.reason === "already_running") return s.alreadyRunning;
  if (result.reason) return fill(s.refusal[result.reason], { product });
  return result.message ?? s.alreadyRunning;
}

/**
 * "Keep it" — the hotel telling us they want this product after the trial.
 *
 * ## Why this only records an intention
 *
 * It would be easy to make this button convert the trial, and it would be wrong. Nobody has quoted
 * this hotel a price yet, and `@revio/core`'s trials module states the rule: **a trial must never
 * become a charge on its own.** A customer who finds a subscription they did not agree to will not
 * stay one. So this writes "they asked" and stops; an operator converts it on the client page after
 * the conversation about what it costs.
 *
 * The role gate is the same list that decides who may START a trial (`isTrialDecider`), because it
 * is the same question: can this person commit the account to something that becomes a bill. The
 * banner itself is shown to everybody — a receptionist should still know why the product will stop
 * next Tuesday — but only a decider is offered the button.
 */
export async function keepThisTrial(): Promise<void> {
  const g = await guard("manageSubscription");
  if (!g.ok) return flashError(g.error);
  const session = g.session;

  const result = await requestKeepTrial({
    tenantId: session.tenantId,
    product: "crs",
    userId: session.userId,
  });
  if (!result.ok) {
    return flashError((await flashSay()).noTrial);
  }

  await setFlash(
    "success",
    result.alreadyAsked
      ? (await i18n()).t(productStrings).trial.keepAlready
      : (await i18n()).t(productStrings).trial.keepThanks,
  );
  // "layout", not the default: the strip lives in the layout, so a page-only revalidation would
  // leave it still asking a question the hotel has just answered.
  revalidatePath("/", "layout");
}
