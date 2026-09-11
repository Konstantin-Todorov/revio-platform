import { redirect } from "next/navigation";
import { productLinks, productUpsells } from "@revio/ui/product-links";
import { Lock } from "lucide-react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getSession, getSwitchableProperties } from "@/lib/session";
import { getNotifications } from "@/lib/data";
import { FieldGuard } from "@revio/ui/field-guard";
import { FlashToast } from "@revio/ui/flash-toast";
import { UsageBeacon } from "@revio/ui/usage-beacon";
import { recordScreenView } from "@/lib/actions-usage";
import { readFlash, FLASH_COOKIE } from "@revio/ui/flash";
import { runningTrialFor } from "@revio/db";
import { trialBanner, isTrialDecider } from "@revio/core";
import { TrialStrip } from "@revio/ui/trial-banner";
import { keepThisTrial } from "@/lib/actions-self-trial";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");

  if (!session.entitlements.reservation) {

    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-7 w-7" /></div>
        <h1 className="text-[18px] font-bold text-ink-900">RevioCRS isn’t enabled for {session.tenantName}</h1>
        <p className="mt-1.5 max-w-sm text-[13px] text-ink-500">This hotel hasn’t subscribed to the Reservation System. Contact Revio to enable it.</p>
      </div>
    );
  }

  const properties = (await getSwitchableProperties(session.tenantId)).map((p) => ({ id: p.id, name: p.name, tenantName: p.tenant.name }));
  const canGroup = properties.length > 1;
  const activeName =
    session.scope === "group"
      ? "All properties"
      : properties.find((p) => p.id === session.activePropertyId)?.name ?? session.tenantName;
  const { items: notifItems } = await getNotifications();

  /* One login, every product the hotel bought — resolved here because the account menu is a
     client component and only the server can read the sibling hostnames. */
  const entitlements = {
    hasChannelManager: session.entitlements.channelManager,
    hasReservation: session.entitlements.reservation,
    hasPms: session.entitlements.pms,
  };
  const products = productLinks(entitlements, "crs");
  const upsells = productUpsells(entitlements);

  /*
   * Is this product being tried rather than owned?
   *
   * Asked for THIS product only. A hotel that pays for RevioLink and is trying RevioPMS must not see
   * a trial strip over the product they pay for — it would read as their paid software about to stop.
   * One product per app, which is also why the key is a constant here rather than a search.
   */
  const trial = await runningTrialFor(session.tenantId, "crs");
  const banner = trial
    ? trialBanner(
        {
          product: "crs",
          startedAt: trial.startedAt,
          endsAt: trial.endsAt,
          keepRequested: trial.keepRequestedAt !== null,
        },
        new Date(),
        (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
      )
    : null;

  return (
    <ShellProvider>
      {/* The document scrolls. The sidebar is fixed and the topbar is sticky, so the chrome
            still stays put — but wheel, keyboard, scrollbar and scroll restoration are all native
            browser behaviour instead of something we reimplement. */}
        <div className="min-h-screen">
        <Sidebar footer={session.tenantName} />
        <div className="flex min-h-screen min-w-0 flex-col lg:pl-[248px]">
          <Topbar products={products} upsells={upsells} properties={properties} activeId={session.activePropertyId} activeName={activeName} scope={session.scope} canGroup={canGroup} role={session.role} userName={session.userName} notifItems={notifItems} />
          {/* `relative` on <main> is load-bearing: it makes <main> the containing block for its
              absolutely-positioned `sr-only` descendants (amenity chips, hero shading radios). Without
              it they escape to <html>, sit at their deep static-flow position, and inflate
              documentElement.scrollHeight past the viewport — the window then scrolls into that empty
              region and drags the fixed-height shell up ("dead space / the page looks broken"). */}
          <main className="relative flex-1 bg-surface-page px-4 py-4 lg:px-6 lg:py-6">
            {/*
              Keyed by the property in view.

              Switching hotels re-renders the server components, but React keeps every CLIENT
              component mounted at the same position — so their `useState(props)` and uncontrolled
              `defaultValue` still hold the PREVIOUS hotel's values. That is not just a stale label:
              a form pre-filled from hotel A, submitted while hotel B is selected, writes A's values
              onto B. It showed up as the booking address suggesting the wrong hotel's name, and the
              appearance form was one click away from copying one hotel's branding onto another.

              Changing the key remounts the subtree, which is exactly the intent: a different hotel
              is different data, not the same screen with new props.
            */}
            <div key={`${session.scope}:${session.activePropertyId}`} className="mx-auto max-w-[1400px]">
              {/* Y1: instant, in-place feedback on a numeric field typed into wrongly. A number
                  input HIDES invalid text (its value reads as ""), so without this a bad field looks
                  merely empty — nothing objects, and the form saves a value nobody chose. */}
              <FieldGuard />
            {/* A server action that refused says so here. Without it a form that
                legitimately declined came back looking untouched. */}
            <FlashToast flash={await readFlash()} cookieName={FLASH_COOKIE} />
            {/* Above the page, below the chrome: the first thing read on arrival at any screen,
                and it scrolls away with the content rather than following the user down it. */}
            {banner && (
              <TrialStrip
                banner={banner}
                {...(isTrialDecider(session.role) ? { keepAction: keepThisTrial } : {})}
              />
            )}
            {/* Which screen is open. Renders nothing; see UsageBeacon. */}
            <UsageBeacon record={recordScreenView} />
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
