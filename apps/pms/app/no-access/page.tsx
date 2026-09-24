import { redirect } from "next/navigation";
import { productOrigin } from "@revio/ui/product-links";
import { RoleLocked } from "@revio/ui/role-locked";
import { ROLE_LABEL, roleCanOpenProduct } from "@revio/core";
import { getSession } from "@/lib/session";
import { i18n } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/shell";

export const dynamic = "force-dynamic";

/**
 * "Your role has no access to this product."
 *
 * ⚠️ **It is a ROUTE, and it has to be — outside `(protected)`.**
 *
 * The obvious implementation is a branch in the protected layout that returns this screen instead of
 * `{children}`, and it is wrong in a way that does not show on screen. In the App Router the page
 * segment is rendered independently of what the layout returns: a layout that quietly drops
 * `{children}` still leaves Next to execute the page and stream it into the RSC flight payload. The
 * first version of this guard did exactly that, and the proof was a real guest's name sitting in the
 * response body behind a screen that said access was refused. `redirect()` throws, which aborts the
 * whole render — that is why the original scoped-role guard used one, and why this is a redirect
 * target rather than a component the layout returns.
 *
 * It re-checks rather than trusting the referrer: a URL anybody can type must not be a place to read
 * a role from.
 */
export default async function NoAccessPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Somebody who DOES have access has no business on this screen — send them to the product.
  if (roleCanOpenProduct(session.role, "pms")) redirect("/dashboard");

  const { t, locale } = await i18n();
  return (
    <RoleLocked
      product="pms"
      role={session.role}
      roleLabel={t(shell).roles[session.role] ?? ROLE_LABEL[session.role] ?? session.role}
      locale={locale}
      hrefFor={(k) => productOrigin(k)}
    />
  );
}
