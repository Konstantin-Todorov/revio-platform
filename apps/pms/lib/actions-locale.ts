"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, parseLocale } from "@revio/ui/i18n";
import { prisma } from "./db";
import { getSession } from "./session";
import { str } from "./mutation-helpers";

/**
 * Switch the language this person reads the staff products in.
 *
 * Stored on the PERSON (`User.locale`), so it holds on every device and in every product the hotel
 * runs; the cookie covers the sign-in screen, where there is no person yet. Anyone signed in may
 * change their own — it is a preference, not a permission.
 */
export async function setLocale(fd: FormData): Promise<void> {
  // The picker only ever submits a real locale; anything else is a crafted POST and changes nothing.
  const locale = parseLocale(str(fd, "locale"));
  if (locale) {
    const session = await getSession();
    if (session) await prisma.user.update({ where: { id: session.userId }, data: { locale } });
    (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/", "layout");
  }
}
