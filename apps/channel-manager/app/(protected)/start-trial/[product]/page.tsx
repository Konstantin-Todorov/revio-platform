import { redirect } from "next/navigation";
import { PRODUCT_BY_KEY, TRIAL_DAYS, canSelfStartTrial, type ProductKey } from "@revio/core";
import { fill } from "@revio/ui/i18n";
import { productStrings } from "@revio/ui/product-strings";
import { i18n } from "@/lib/i18n/server";
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

  /*
   * The promises and the refusal are core's (`selfTrialPromises`, `canSelfStartTrial`), worded in the
   * reader's language from the same facts — `product-drift.test.ts` holds the English to core's.
   */
  const { t, locale } = await i18n();
  const s = t(productStrings);
  const vars = { product: info.name, days: TRIAL_DAYS };
  const p = s.trial.promises;
  const promises = [
    p.on, p.noCharge, p.noImport, TRIAL_DAYS > 7 ? p.reminderWeek : p.reminderFew, p.noAuto, p.payFromDecide, p.separate,
  ].map((line) => fill(line, vars));
  const refusal = verdict.ok ? null : verdict.reason ? fill(s.trial.refusal[verdict.reason], vars) : verdict.message ?? null;

  return (
    <StartTrialPanel
      productName={info.name}
      tagline={s.tagline[info.key]}
      days={TRIAL_DAYS}
      promises={promises}
      refusal={refusal}
      locale={locale}
      action={beginSelfTrial}
      cancelHref="/dashboard"
    >
      <input type="hidden" name="product" value={product} />
    </StartTrialPanel>
  );
}
