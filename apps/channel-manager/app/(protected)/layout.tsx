import { redirect } from "next/navigation";
import { productLinks, productUpsells, productOrigin } from "@revio/ui/product-links";
import { ProductLocked } from "@revio/ui/product-locked";
import { KeepItButton } from "@/components/shell/KeepItButton";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getSession, getSwitchableProperties } from "@/lib/session";
import { getConnectivityLabel, getNotifications } from "@/lib/data";
import { FieldGuard } from "@revio/ui/field-guard";
import { FlashToast } from "@revio/ui/flash-toast";
import { UsageBeacon } from "@revio/ui/usage-beacon";
import { recordScreenView } from "@/lib/actions-usage";
import { readFlash, FLASH_COOKIE } from "@revio/ui/flash";
import { allTrialsFor, runningTrialFor } from "@revio/db";
import { trialBanner, isTrialDecider, productAccessState } from "@revio/core";
import { TrialStrip } from "@revio/ui/trial-banner";
import { keepThisTrial } from "@/lib/actions-self-trial";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");

  /*
   * ⚠️ The one screen that decides whether a hotel that liked us comes back.
   *
   * This used to be a hand-written sentence — "This hotel hasn't subscribed … Contact Revio" —
   * repeated in all three apps. It was false for a hotel whose trial had just ended, it offered no
   * way to act, and fixing it in one app would have left the other two lying. `ProductLocked` is
   * shared, and `productAccessState` decides which of the three situations this actually is.
   */
  if (!session.entitlements.channelManager) {
    const access = productAccessState({
      product: "cm",
      trials: await allTrialsFor(session.tenantId),
      entitlements: {
        cm: session.entitlements.channelManager,
        crs: session.entitlements.reservation,
        pms: session.entitlements.pms,
      },
    });
    return (
      <>
        <ProductLocked
          state={access}
          hotelName={session.tenantName}
          fmtDate={(d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          hrefFor={(k) => productOrigin(k as "cm" | "crs" | "pms")}
          {...(access.reason === "trial-ended"
            ? { action: <KeepItButton product="cm" /> }
            : {})}
        />
      </>
    );
  }

  const properties = (await getSwitchableProperties(session.tenantId)).map((p) => ({ id: p.id, name: p.name, tenantName: p.tenant.name }));
  const activeName = properties.find((p) => p.id === session.activePropertyId)?.name ?? session.tenantName;
  const { items: notifItems } = await getNotifications();
  const connectivityLabel = await getConnectivityLabel();

  /* One login, every product the hotel bought — resolved here because the account menu is a
     client component and only the server can read the sibling hostnames. */
  const entitlements = {
    hasChannelManager: session.entitlements.channelManager,
    hasReservation: session.entitlements.reservation,
    hasPms: session.entitlements.pms,
  };
  const products = productLinks(entitlements, "cm");
  const upsells = productUpsells(entitlements);

  /*
   * Is this product being tried rather than owned?
   *
   * Asked for THIS product only. A hotel that pays for RevioLink and is trying RevioPMS must not see
   * a trial strip over the product they pay for — it would read as their paid software about to stop.
   * One product per app, which is also why the key is a constant here rather than a search.
   */
  const trial = await runningTrialFor(session.tenantId, "cm");
  const banner = trial
    ? trialBanner(
        {
          product: "cm",
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
        <Sidebar connectivityLabel={connectivityLabel} />
        <div className="flex min-h-screen min-w-0 flex-col lg:pl-[248px]">
          <Topbar products={products} upsells={upsells} properties={properties} activeId={session.activePropertyId} activeName={activeName} role={session.role} userName={session.userName} notifItems={notifItems} />
          {/* `relative` on <main> is load-bearing: it makes <main> the containing block for its
              absolutely-positioned `sr-only` descendants (amenity chips, hero shading radios). Without
              it they escape to <html>, sit at their deep static-flow position, and inflate
              documentElement.scrollHeight past the viewport — the window then scrolls into that empty
              region and drags the fixed-height shell up ("dead space / the page looks broken"). */}
          <main className="relative flex-1 bg-surface-page px-4 py-4 lg:px-6 lg:py-6">
            {/* Keyed by the property in view — switching hotels re-renders the server components but
                leaves CLIENT components mounted, holding the previous hotel's form values. A form
                pre-filled from hotel A and submitted under hotel B writes A's values onto B. */}
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
            <div key={session.activePropertyId} className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
