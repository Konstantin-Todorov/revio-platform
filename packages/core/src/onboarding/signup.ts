import { PRODUCT_BY_KEY, type ProductKey } from "../products/products.js";

/**
 * The decisions a public signup makes before it touches the database.
 *
 * Pure and here rather than in `packages/db` so they can be tested without one — the provisioning
 * transaction itself needs a real database and is verified on a deployment, but nothing that can be
 * decided from the form alone should have to wait for that.
 */

export interface SignupInput {
  hotelName: string;
  ownerName: string;
  email: string;
  intent: string;
}

export interface SignupFields {
  hotelName: string;
  ownerName: string;
  email: string;
  intent: ProductKey;
}

export type SignupValidation = { ok: true; fields: SignupFields } | { ok: false; message: string };

/**
 * ⚠️ Every message here describes the FORM, never the account behind it.
 *
 * "That email is already registered" would turn this page into a way to find out which hoteliers
 * use Revio, one guess at a time — so that answer is not produced here or anywhere else in the
 * flow. The only refusals are about what was typed.
 */
export function validateSignup(input: SignupInput): SignupValidation {
  const hotelName = input.hotelName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();

  if (!hotelName) return { ok: false, message: "Tell us the name of your hotel." };
  if (hotelName.length > 120) return { ok: false, message: "That hotel name is too long — 120 characters at most." };
  if (!ownerName) return { ok: false, message: "Tell us your name, so we know who to greet." };
  // Deliberately permissive: a real address we cannot parse is worse than a fake one we accept,
  // because the confirmation link is itself the check that the address works.
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return { ok: false, message: "That email address doesn't look right." };
  if (!PRODUCT_BY_KEY[input.intent as ProductKey]) {
    return { ok: false, message: "Pick the one thing you need most — you still get all three." };
  }

  return { ok: true, fields: { hotelName, ownerName, email, intent: input.intent as ProductKey } };
}

/**
 * A URL-safe tenant slug from a hotel's own name.
 *
 * It has to survive names we will actually be given — Cyrillic, accents, ampersands, quotes — and
 * never produce an empty string, because a blank slug would collide with every other blank one and
 * the first hotel to hit it would silently take the second one's URL.
 */
export function signupSlug(hotelName: string): string {
  const base = hotelName
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining marks so "Hôtel" becomes "hotel" rather than losing the letter entirely.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || "hotel";
}
