/**
 * What a Stripe key is, read from the key itself — before it is ever sent anywhere.
 *
 * Pure and tested, and separate from the network check on purpose: nine out of ten bad pastes are
 * recognisable without a round trip (a publishable key in the secret box, a live key in the sandbox
 * slot, a copied line with a trailing quote), and telling somebody that instantly is a better screen
 * than a spinner followed by "authentication failed".
 *
 * ## The one that actually costs money
 *
 * **Mode is chosen by a person and validated against the key, never inferred from it.** Stripe puts
 * the mode in the prefix, so inferring is trivial and that is exactly the trap: paste a live key into
 * the field you believe is a sandbox and inference cheerfully agrees with you. Real cards are then
 * charged by somebody who thinks they are rehearsing.
 *
 * This is the same class as the Channex sandbox/production trap already documented in the root
 * `CLAUDE.md`, which has cost a day once. There, two accounts quietly diverged; here, money moves.
 *
 * ## The second one
 *
 * **A test key and a live key produce different customer, payment-method and intent ids, and neither
 * account can see the other's.** So switching modes does not migrate anything — every stored Stripe
 * id from the old mode becomes a dangling reference. `switchWarning` is what says that out loud at
 * the moment somebody switches, rather than leaving it to be discovered when a saved card fails.
 */

export type StripeMode = "test" | "live";

export const STRIPE_MODES: StripeMode[] = ["test", "live"];

export function isStripeMode(v: string | null | undefined): v is StripeMode {
  return v === "test" || v === "live";
}

/** What kind of key was pasted. `unknown` covers everything Stripe does not issue in this shape. */
export type StripeKeyKind = "secret" | "restricted" | "publishable" | "webhook" | "unknown";

export interface StripeKeyShape {
  kind: StripeKeyKind;
  /** The mode the key itself declares. `null` when the key does not carry one (webhook secrets). */
  mode: StripeMode | null;
}

/**
 * Read a key's kind and mode from its prefix.
 *
 * Deliberately not a regex over the whole string. Stripe has changed key LENGTH and alphabet more
 * than once and says so in its own docs; a strict full-string pattern would start refusing valid
 * keys on a day nobody is expecting it, which is a worse failure than accepting a typo that the
 * network check catches a second later.
 */
export function readStripeKey(raw: string): StripeKeyShape {
  const k = raw.trim();
  if (k.startsWith("sk_test_")) return { kind: "secret", mode: "test" };
  if (k.startsWith("sk_live_")) return { kind: "secret", mode: "live" };
  if (k.startsWith("rk_test_")) return { kind: "restricted", mode: "test" };
  if (k.startsWith("rk_live_")) return { kind: "restricted", mode: "live" };
  if (k.startsWith("pk_test_")) return { kind: "publishable", mode: "test" };
  if (k.startsWith("pk_live_")) return { kind: "publishable", mode: "live" };
  if (k.startsWith("whsec_")) return { kind: "webhook", mode: null };
  return { kind: "unknown", mode: null };
}

export type KeyProblem = { ok: false; error: string };
export type KeyAccepted = { ok: true; shape: StripeKeyShape; hint: string };

/**
 * The hint the screen shows ever afterwards: `sk_test_••••4242`.
 *
 * The prefix is kept because it is the half that carries meaning — it says at a glance which mode
 * and which kind of key is installed, which is precisely the question somebody opens the screen to
 * answer. The tail is four characters, matching how Stripe's own dashboard lets you recognise a key,
 * and it is the only part of the secret that ever leaves the database.
 */
export function stripeHint(raw: string): string {
  const k = raw.trim();
  const underscore = k.indexOf("_", k.indexOf("_") + 1);
  const prefix = underscore > 0 ? k.slice(0, underscore + 1) : "";
  return `${prefix}••••${k.slice(-4)}`;
}

/**
 * Validate a pasted SECRET key against the mode the operator chose.
 *
 * Every refusal names what was actually pasted, because "invalid key" in front of somebody holding
 * a key they just copied from Stripe is not a message, it is an argument.
 */
export function validateSecretKey(raw: string, mode: StripeMode): KeyProblem | KeyAccepted {
  const k = raw.trim();
  if (!k) return { ok: false, error: "Paste the secret key from your Stripe dashboard." };
  if (/\s/.test(k)) {
    return { ok: false, error: "That key contains a space or line break — it was probably copied with something else. Copy just the key." };
  }

  const shape = readStripeKey(k);

  if (shape.kind === "publishable") {
    return {
      ok: false,
      error: "That is the PUBLISHABLE key (pk_…), which is safe to show in a browser and cannot charge anything. The secret key starts sk_ and is hidden behind “Reveal” in your Stripe dashboard.",
    };
  }
  if (shape.kind === "webhook") {
    return { ok: false, error: "That is a webhook signing secret (whsec_…), not an API key. It goes in the webhook field below." };
  }
  if (shape.kind === "unknown") {
    return { ok: false, error: "That does not look like a Stripe key. A secret key starts sk_test_ or sk_live_; a restricted key starts rk_." };
  }

  /*
   * The refusal that matters, stated in both directions.
   *
   * A live key in the sandbox slot is the dangerous one — it charges real cards while somebody
   * believes they are testing. A test key in the live slot is merely broken, but it is refused just
   * as firmly: silently accepting it would leave a "live" configuration that can never take a
   * payment, discovered by a customer.
   */
  if (shape.mode !== mode) {
    return shape.mode === "live"
      ? {
          ok: false,
          error: "That is a LIVE key and this is the sandbox slot. Real cards would be charged. Paste the test key (sk_test_…), or switch this connection to live first — deliberately.",
        }
      : {
          ok: false,
          error: "That is a TEST key and this is the live slot. It would accept no real payment. Paste the live key (sk_live_…), or switch this connection back to sandbox.",
        };
  }

  return { ok: true, shape, hint: stripeHint(k) };
}

/** Validate a publishable key. Not a secret — but it must still match the mode, or Elements breaks. */
export function validatePublishableKey(raw: string, mode: StripeMode): KeyProblem | { ok: true; value: string } {
  const k = raw.trim();
  if (!k) return { ok: true, value: "" }; // optional
  const shape = readStripeKey(k);
  if (shape.kind !== "publishable") {
    return {
      ok: false,
      error: shape.kind === "secret" || shape.kind === "restricted"
        // Loudly, because this one is a secret going into a field whose value is designed to be sent
        // to browsers. Refusing is not enough — the person has to know to rotate it.
        ? "That is a SECRET key. Do not put it here — this field is sent to browsers. Go to Stripe and roll that key now, then paste the publishable one (pk_…)."
        : "The publishable key starts pk_test_ or pk_live_.",
    };
  }
  if (shape.mode !== mode) {
    return { ok: false, error: `That publishable key is for ${shape.mode} mode and this connection is ${mode}. The two must match or the payment form will not load.` };
  }
  return { ok: true, value: k };
}

/** Validate a webhook signing secret. */
export function validateWebhookSecret(raw: string): KeyProblem | { ok: true; value: string } {
  const k = raw.trim();
  if (!k) return { ok: true, value: "" }; // optional
  if (!k.startsWith("whsec_")) {
    return { ok: false, error: "A webhook signing secret starts whsec_. Stripe shows it once, when you add the endpoint." };
  }
  return { ok: true, value: k };
}

/**
 * What switching modes actually breaks, said before it is switched.
 *
 * Not a confirmation dialog for its own sake. Stripe ids are scoped to one account, so every stored
 * customer and card token from the mode being left is about to become a reference to something that
 * does not exist — and the symptom is a saved card that silently stops working on a future booking,
 * which is the hardest kind of bug to trace back to a settings change made weeks earlier.
 */
export function switchWarning(from: StripeMode, to: StripeMode): string | null {
  if (from === to) return null;
  return to === "live"
    ? "Going live: from now on real cards are charged and real money moves. Customer and card ids saved in sandbox do not exist in the live account, so any stored payment method will stop working and has to be collected again."
    : "Going back to sandbox: nothing will be charged. Customer and card ids saved in live mode do not exist in the sandbox account, so anything stored against them will not resolve.";
}

/**
 * What a save should actually change — the decision that made a three-field form editable.
 *
 * ## The bug this replaces
 *
 * The form's three fields each treated an empty box differently, and nothing on screen said so:
 * the secret key was `required`, so changing anything meant re-pasting it; an empty publishable
 * key silently **wiped** the stored one; an empty webhook secret kept it. The founder hit all
 * three at once on the live credential — two fields correct, the third needing a publishable key,
 * and no way to add it without re-entering a webhook secret that Stripe shows exactly once.
 *
 * ## The rule
 *
 * **Empty means keep, for every field, once a credential exists.** A credential that does not
 * exist yet still needs a secret key, because there is nothing to keep. Clearing a stored value is
 * deliberately NOT expressible here: nothing in the product needs it, and a blank box that can
 * either keep or destroy depending on context is the ambiguity this function exists to remove.
 *
 * Pure so the rule can be proved rather than described. The action does the encryption and the
 * network check; this only decides which fields are in play.
 */
export interface KeyEditInput {
  /** Whether a credential already exists for this mode. */
  exists: boolean;
  secret: string;
  publishable: string;
  webhook: string;
}

export interface KeyEdit {
  /** False when the stored secret is kept — the caller must decrypt it to re-test, not rewrite it. */
  replaceSecret: boolean;
  writePublishable: boolean;
  writeWebhook: boolean;
  /** Set only when there is nothing stored and nothing was pasted. */
  refusal: string | null;
}

export function planKeyEdit(input: KeyEditInput): KeyEdit {
  const secret = input.secret.trim();
  const keep = secret === "" && input.exists;
  return {
    replaceSecret: !keep,
    writePublishable: input.publishable.trim() !== "",
    writeWebhook: input.webhook.trim() !== "",
    refusal: secret === "" && !input.exists ? "Paste the secret key from your Stripe dashboard." : null,
  };
}
