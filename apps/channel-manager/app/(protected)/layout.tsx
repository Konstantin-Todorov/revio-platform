import { redirect } from "next/navigation";
import { productLinks, productUpsells } from "@revio/ui/product-links";
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
import { runningTrialFor } from "@revio/db";
import { trialBanner, isTrialDecider, roleCanOpenProduct } from "@revio/core";
import { TrialStrip } from "@revio/ui/trial-banner";
import { keepThisTrial } from "@/lib/actions-self-trial";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/logout");

  /*
   * ⚠️ **Does this ROLE belong in this product at all?** A `redirect`, never a returned component.
   *
   * The accounts are one shared identity across the platform — that is the product's central claim,
   * and it means a role created in another product authenticates here perfectly well. Nothing in
   * this app filtered a screen by role until 2026-09-14, so such an account could read the hotel's
   * whole book. RLS never covered this and could not: two staff at one hotel are the same tenant, so
   * the database hands them identical rows. Only the role tells them apart.
   *
   * It must be a redirect. A layout that returns a "no access" screen instead of `{children}` leaves
   * Next to render the page segment anyway and stream it into the RSC payload — the first version of
   * this guard did that, and a real guest's name was sitting in the response behind the refusal.
   * `redirect()` throws, so nothing below it runs.
   *
   * Sequenced before the entitlement branch on purpose: what a role may open is not a commercial
   * question, and offering a trial to a cleaner is the wrong conversation with the wrong person.
   */
  if (!roleCanOpenProduct(session.role, "cm")) redirect("/no-access");

  /*
   * ⚠️ The one screen that decides whether a hotel that liked us comes back — now a REDIRECT.
   *
   * The screen itself is unchanged (`app/locked/page.tsx`, still `ProductLocked`). What changed is
   * that this branch used to RETURN it in place of `{children}`, which does not stop the page from
   * rendering: Next executes the page segment regardless and streams it into the RSC payload. With
   * the entitlement switched off, the response was 211 KB and carried a real guest's name behind a
   * screen saying the hotel had not subscribed. The product was locked; its data was not.
   */
  if (!session.entitlements.channelManager) redirect("/locked");

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
