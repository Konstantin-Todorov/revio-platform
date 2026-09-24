import { ShieldAlert, ArrowRight } from "lucide-react";
import { productsForRole, type HotelProduct } from "@revio/core";
import { fill, translate, type Locale } from "./i18n";
import { productStrings } from "./product-strings";

const PRODUCT_NAME: Record<HotelProduct, string> = {
  cm: "RevioLink",
  crs: "RevioCRS",
  pms: "RevioPMS",
};

/**
 * The screen a person meets when their ROLE has no business in this product.
 *
 * ⚠️ Not the same thing as `ProductLocked`, and the difference matters to the person reading it.
 * That screen says *the hotel has not bought this* — a commercial fact, and the reader may well be
 * the one who decides. This says *you personally do not have access to this*, which is nobody's
 * mistake and has a different next step: ask the owner, or go where you do belong.
 *
 * It exists because the accounts are one shared identity. A housekeeper created in RevioPMS can
 * authenticate against RevioCRS perfectly well, and until 2026-09-14 nothing there filtered a single
 * screen by role. Blocking the route without saying anything would have produced a redirect loop or
 * a blank page; saying "access denied" and stopping would leave somebody stuck mid-shift. So it
 * names the role, names the product, and offers the doors that do open.
 *
 * One component for all three apps, for the reason `ProductLocked`'s own note gives: three copies of
 * a sentence is how all three came to say something untrue.
 */
export function RoleLocked({
  product,
  role,
  roleLabel,
  hrefFor,
  signOutHref = "/logout",
  locale = "en",
}: {
  product: HotelProduct;
  /** The raw role as stored, used to work out where they CAN go. */
  role: string;
  /** How the product spells that role to a human — "Housekeeper", not "housekeeper". */
  roleLabel: string;
  /** Server-resolved origins, since only the server can read the sibling hostnames. */
  hrefFor: (key: HotelProduct) => string;
  signOutHref?: string;
  /** A server component, so the language arrives as a prop. `roleLabel` should be in it too. */
  locale?: Locale;
}) {
  const s = translate(productStrings, locale).role;
  // Where this person actually belongs. Never includes the product they are standing in.
  const open = productsForRole(role).filter((p) => p !== product);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">
          {fill(s.title, { product: PRODUCT_NAME[product] })}
        </h1>
        {/* Names the role rather than saying "insufficient permissions", so the person can repeat the
            sentence to whoever gives them access without having to describe a screen. */}
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-600">
          {s.bodyBefore}<b className="font-semibold text-ink-900">{roleLabel}</b>
          {fill(s.bodyAfter, {
            where: open.length > 0 ? PRODUCT_NAME[open[0]!] : s.elsewhere,
            product: PRODUCT_NAME[product],
          })}
        </p>

        {open.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {open.map((p) => (
              <a
                key={p}
                href={hrefFor(p)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-900"
              >
                {fill(s.goTo, { product: PRODUCT_NAME[p] })} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}

        <p className="mt-6 text-[12px] text-ink-400">
          {s.wrongAccount} <a href={signOutHref} className="font-semibold text-brand-600 hover:underline">{s.signOut}</a>
        </p>
      </div>
    </div>
  );
}
