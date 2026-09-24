import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "@revio/ui/i18n";
import { getSession } from "./session";

/**
 * The language to render this request in: the signed-in person's choice, then the device's cookie
 * (the only thing that exists before sign-in), then English. See `@revio/ui/i18n`.
 */
export async function getLocale(): Promise<Locale> {
  const session = await getSession().catch(() => null);
  return resolveLocale(session?.locale, (await cookies()).get(LOCALE_COOKIE)?.value);
}
