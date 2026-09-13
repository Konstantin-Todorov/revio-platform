import { redirect } from "next/navigation";
import { productOrigin } from "@revio/ui/product-links";
import { ProductLocked } from "@revio/ui/product-locked";
import { productAccessState } from "@revio/core";
import { allTrialsFor } from "@revio/db";
import { KeepItButton } from "@/components/shell/KeepItButton";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * "Your hotel does not currently have this product."
 *
 * ⚠️ **A ROUTE, not a branch in the protected layout — and that distinction is the whole point.**
 *
 * This screen lived inside the layout, which returned it instead of `{children}`. It looked right and
 * it was not: in the App Router the page segment renders independently of what the layout returns, so
 * Next executed the dashboard anyway and streamed it into the RSC flight payload. Measured on
 * 2026-09-14 with the entitlement switched off locally — the response was 211 KB and contained a real
 * guest's name, behind a screen saying the hotel had not subscribed. The product was locked; its data
 * was not.
 *
 * `redirect()` throws, so the layout stops before anything below it runs. That is the only reliable
 * way to refuse a render here, and it is why the scoped-role guard has always used one.
 *
 * The screen itself is unchanged and still `ProductLocked` — the job is not to explain a licence but
 * to give the most valuable visitor we have, a hotel that used this for thirty days, something to
 * press.
 */
export default async function LockedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Somebody who DOES hold the product has no business here — a stale tab, or a typed URL.
  if (session.entitlements.pms) redirect("/dashboard");

  const access = productAccessState({
    product: "pms",
    trials: await allTrialsFor(session.tenantId),
    entitlements: {
      cm: session.entitlements.channelManager,
      crs: session.entitlements.reservation,
      pms: session.entitlements.pms,
    },
  });

  return (
    <ProductLocked
      state={access}
      hotelName={session.tenantName}
      fmtDate={(d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      hrefFor={(k) => productOrigin(k as "cm" | "crs" | "pms")}
      {...(access.reason === "trial-ended" ? { action: <KeepItButton product="pms" /> } : {})}
    />
  );
}
