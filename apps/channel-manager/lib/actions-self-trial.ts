"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requestKeepTrial, selfStartTrial } from "@revio/db";
import { PRODUCT_BY_KEY, type ProductKey } from "@revio/core";
import { guard } from "./authz";
import { productOrigin } from "@revio/ui/product-links";
import { flashError, setFlash } from "@revio/ui/flash";

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
  if (!info) return flashError("Unknown product.");

  const result = await selfStartTrial({
    tenantId: session.tenantId,
    product,
    role: session.role,
    userId: session.userId,
  });
  if (!result.ok) return flashError(result.message ?? "That trial could not be started.");

  await setFlash(
    "success",
    `${info.name} is on until ${result.trial!.endsAt.toLocaleDateString("en-GB")}. We will email you before it ends, and nothing is charged.`,
  );
  revalidatePath("/", "layout");
  /*
   * Straight into the product, not back to a confirmation.
   *
   * Its own first-run flow already knows which steps this hotel can skip — the property, rooms,
   * rates and branding are shared, so a second product opens on two or three screens rather than
   * six. Landing them anywhere else would waste the one moment the platform's whole claim is most
   * persuasive.
   */
  redirect(productOrigin(product));
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
    product: "cm",
    userId: session.userId,
  });
  if (!result.ok) {
    return flashError("There is no trial running here to keep. Reload the page — it may have finished already.");
  }

  await setFlash(
    "success",
    result.alreadyAsked
      ? "We already have your request and we are on it. Nothing stops in the meantime."
      : "Thank you — we have it. We will be in touch to sort out keeping it, and nothing stops before then.",
  );
  // "layout", not the default: the strip lives in the layout, so a page-only revalidation would
  // leave it still asking a question the hotel has just answered.
  revalidatePath("/", "layout");
}
