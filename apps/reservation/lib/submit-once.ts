import "server-only";
import { claimSubmitToken, DUPLICATE_SUBMIT_MESSAGE } from "@revio/db";
import { setFlash } from "@revio/ui/flash";
import { prisma } from "./db";
import { i18n } from "./i18n/server";

/**
 * True when THIS form submission was already accepted — a second press that got past the browser
 * (before hydration, or a retried request). The caller stops before anything with a consequence,
 * and the person is told it is done rather than shown an error: nothing went wrong.
 * See `SubmitToken` in the schema and `claimSubmitToken` in `@revio/db`.
 */
export async function pressedTwice(fd: FormData, tenantId: string, action: string): Promise<boolean> {
  if (await claimSubmitToken(prisma, fd, tenantId, action)) return false;
  const { locale } = await i18n();
  await setFlash("info", (DUPLICATE_SUBMIT_MESSAGE as Record<string, string>)[locale] ?? DUPLICATE_SUBMIT_MESSAGE.en);
  return true;
}
