import { redirect } from "next/navigation";
import { PRODUCT_BY_KEY, TRIAL_DAYS, canSelfStartTrial, selfTrialPromises, type ProductKey } from "@revio/core";
import { StartTrialPanel } from "@revio/ui/start-trial-panel";
import { forSystem } from "@revio/db";
import { getSession } from "@/lib/session";
import { beginSelfTrial } from "@/lib/actions-self-trial";

/**
 * Where a hotel starts its own trial of another product.
 *
 * Thin on purpose: the rules are pure and shared (`canSelfStartTrial`), the screen is shared
 * (`StartTrialPanel`), and the write is one audited helper (`selfStartTrial`). All three products
 * offer the same trial on the same terms, and three copies of any of those would drift — the half
 * that drifts always being the promise rather than the button.
 *
 * The verdict is computed HERE as well as inside the write, deliberately. This one decides what the
 * screen says; that one decides what happens. A screen that only greyed a button out would leave
 * somebody with no idea why, and a write that trusted the screen would trust a form field.
 */
export const dynamic = "force-dynamic";

export default async function StartTrialPage({ params }: { params: Promise<{ product: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { product } = await params;
  const info = PRODUCT_BY_KEY[product as ProductKey];
  if (!info) redirect("/dashboard");

  const tenant = await forSystem().tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      status: true, hasChannelManager: true, hasReservation: true, hasPms: true,
      productTrials: { select: { product: true } },
    },
  });
  if (!tenant) redirect("/dashboard");

  const verdict = canSelfStartTrial({
    product: product as ProductKey,
    owns: { cm: tenant.hasChannelManager, crs: tenant.hasReservation, pms: tenant.hasPms },
    everTrialled: tenant.productTrials.map((t) => t.product as ProductKey),
    tenantStatus: tenant.status,
    role: session.role,
  });

  return (
    <StartTrialPanel
      productName={info.name}
      tagline={info.tagline}
      days={TRIAL_DAYS}
      promises={selfTrialPromises(product as ProductKey, TRIAL_DAYS)}
      refusal={verdict.ok ? null : verdict.message ?? null}
      action={beginSelfTrial}
      cancelHref="/dashboard"
    >
      <input type="hidden" name="product" value={product} />
    </StartTrialPanel>
  );
}
