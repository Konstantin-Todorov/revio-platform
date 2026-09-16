"use server";

import { redirect } from "next/navigation";
import { issueHandoff } from "@revio/db";
import { productOrigin } from "@revio/ui/product-links";
import { getSession } from "./session";
import { prisma } from "./db";

/**
 * Open another product without signing in again.
 *
 * ## ⚠️ A POST, never a link
 *
 * This mints a session-granting credential, so it cannot sit in an `<a href>`. Next prefetches
 * internal links, browsers preload them, and copying one would hand somebody a key — so the product
 * switcher is a form button, exactly as the workspace switcher is, for exactly the same reason: it
 * writes something.
 *
 * ## What it does not decide
 *
 * Nothing. It checks the session exists and asks for a token; every question about whether this
 * account may open that product — active, entitled, not revoked — is answered by the receiving
 * route, from the database, at the moment of arrival. Deciding here as well would put the same
 * judgement in two places, and the copy that drifts is always the permissive one.
 */
export async function openProduct(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const product = String(fd.get("product") ?? "");
  if (product !== "cm" && product !== "crs" && product !== "pms") redirect("/dashboard");
  // Switching to the product you are already in is a no-op, not a round trip through a credential.
  if (product === "crs") redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  if (!user) redirect("/login");

  const token = await issueHandoff({ userId: session.userId, email: user.email, product });
  redirect(`${productOrigin(product)}/handoff?t=${encodeURIComponent(token)}`);
}
