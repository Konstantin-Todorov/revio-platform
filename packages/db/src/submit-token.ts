/**
 * Accept a create form's token once — the server half of "press once".
 *
 * The form carries a token minted when it was rendered (`@revio/ui/submit-token`, inside every
 * `SubmitButton`). The action calls this BEFORE it does anything with a consequence — before a card
 * is charged, before a row is written — and stops if it returns `false`: this exact form submission
 * has already been accepted. See `SubmitToken` in the schema for why the browser alone cannot do it.
 *
 * `createMany … skipDuplicates` is `INSERT … ON CONFLICT DO NOTHING`: a duplicate is `count: 0`, not
 * an error, so it can also run inside a transaction without aborting it. Two identical tokens racing
 * serialise on the primary key — the second waits for the first to commit, then inserts nothing.
 *
 * A request with NO token (a page rendered before this shipped, a form not on `SubmitButton`) is
 * allowed through: refusing it would break a working screen to guard against a double press.
 */
import { SUBMIT_TOKEN_FIELD } from "@revio/core";

export { SUBMIT_TOKEN_FIELD };

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SubmitTokenDb {
  submitToken: {
    createMany(args: { data: { id: string; tenantId: string | null; action: string }[]; skipDuplicates: boolean }): Promise<{ count: number }>;
  };
}

export async function claimSubmitToken(
  db: SubmitTokenDb,
  fd: FormData,
  tenantId: string | null,
  action: string,
): Promise<boolean> {
  const token = fd.get(SUBMIT_TOKEN_FIELD);
  if (typeof token !== "string" || !TOKEN.test(token)) return true;
  const { count } = await db.submitToken.createMany({
    data: [{ id: token.toLowerCase(), tenantId, action }],
    skipDuplicates: true,
  });
  return count === 1;
}

/** What the person sees when their second press arrives. Nothing is wrong — it is already done. */
export const DUPLICATE_SUBMIT_MESSAGE = {
  en: "That was already done — the second press did not do it again.",
  bg: "Това вече е направено — второто натискане не го направи отново.",
} as const;
