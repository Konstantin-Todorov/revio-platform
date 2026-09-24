import { redirect } from "next/navigation";
import { productLinks, productUpsells } from "@revio/ui/product-links";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ShellProvider } from "@/components/shell/ShellContext";
import { getSession, getSwitchableProperties } from "@/lib/session";
import { getNotificationFeed } from "@/lib/notifications";
import { FieldGuard } from "@revio/ui/field-guard";
import { FlashToast } from "@revio/ui/flash-toast";
import { UsageBeacon } from "@revio/ui/usage-beacon";
import { recordScreenView } from "@/lib/actions-usage";
import { readFlash, FLASH_COOKIE } from "@revio/ui/flash";
import { runningTrialFor, openProductAndGreet } from "@revio/db";
import { publicBaseUrl } from "@revio/email";
import { trialBanner, isTrialDecider, roleCanOpenProduct } from "@revio/core";
import { TrialStrip } from "@revio/ui/trial-banner";
import { keepThisTrial } from "@/lib/actions-self-trial";
import { LOCALE_LABELS } from "@revio/ui/i18n";
import { i18n } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/shell";
import { translationOn } from "@/lib/i18n/ready";

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
  if (!roleCanOpenProduct(session.role, "crs")) redirect("/no-access");

  /*
   * ⚠️ The one screen that decides whether a hotel that liked us comes back — now a REDIRECT.
   *
   * The screen itself is unchanged (`app/locked/page.tsx`, still `ProductLocked`). What changed is
   * that this branch used to RETURN it in place of `{children}`, which does not stop the page from
   * rendering: Next executes the page segment regardless and streams it into the RSC payload. With
   * the entitlement switched off, the response was 211 KB and carried a real guest's name behind a
   * screen saying the hotel had not subscribed. The product was locked; its data was not.
   */
  if (!session.entitlements.reservation) redirect("/locked");

  /*
   * ⚠️ Opening the product is what starts its trial — not signing up.
   *
   * All three clocks used to begin at signup, so a hotel that spent a fortnight in one product met
   * the next with half its trial gone. `openProductAndGreet` stamps the first arrival and moves the
   * thirty days to begin here.
   *
   * Placed AFTER the entitlement check on purpose: a hotel that cannot open this product has not
   * opened it, and stamping first would start a clock on a door that did not let them through.
   * Idempotent by its WHERE (`openedAt: null`), so every visit after the first writes nothing.
   */
  await openProductAndGreet(session.tenantId, "crs", `${publicBaseUrl()}/dashboard`);

  const allProperties = await getSwitchableProperties(session.tenantId);
  const properties = allProperties.map((p) => ({ id: p.id, name: p.name, tenantName: p.tenant.name }));
  /* ⚠️ The notification panel's day headings are the PROPERTY's days — the platform's one rule
     about dates. UTC calls a 01:30 Sofia booking yesterday's until 03:00, which is the shift most
     likely to be reading this. */
  const activeTimeZone = allProperties.find((p) => p.id === session.activePropertyId)?.timezone ?? "UTC";
  const canGroup = properties.length > 1;
  const { t: tr, locale } = await i18n();
  const t = tr(shell);
  const activeName =
    session.scope === "group"
      ? t.switcher.allProperties
      : properties.find((p) => p.id === session.activePropertyId)?.name ?? session.tenantName;
  const feed = await getNotificationFeed();

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
        (d) => d.toLocaleDateString(locale === "en" ? "en-GB" : LOCALE_LABELS[locale].intl, { day: "numeric", month: "long" }),
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
          <Topbar products={products} upsells={upsells} properties={properties} activeId={session.activePropertyId} activeName={activeName} scope={session.scope} canGroup={canGroup} roleLabel={t.roles[session.role] ?? session.role} userName={session.userName} feed={feed} timeZone={activeTimeZone} canSwitchLanguage={translationOn()} />
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
                locale={locale}
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
