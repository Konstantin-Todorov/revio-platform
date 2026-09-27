import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { SignupForm } from "@/components/auth/SignupForm";
import { LanguageSwitch } from "@/components/auth/LanguageSwitch";
import { i18n } from "@/lib/i18n/server";
import { signup as signupDict } from "@/lib/i18n/signup";
import { auth } from "@/lib/i18n/auth";
import { translationOn } from "@/lib/i18n/ready";

export async function generateMetadata() {
  return { title: (await i18n()).t(signupDict).meta.start };
}

/**
 * The front door.
 *
 * Hosted on the RevioLink origin because that is the product we lead with and it already has the
 * public auth surfaces (login, reset, accept-invite) this flow finishes in. **It is not a RevioLink
 * signup** — the account it creates owns all three products, so the page wears the platform's name
 * rather than the product's. When a central login lands at its own origin, this moves there and
 * leaves a redirect.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  /*
   * `?email=` prefills the field, and nothing more.
   *
   * It exists for the trial link the operator console sends an enquiry: the address we invited
   * should be the address that gets the trial, without anyone retyping it. It is NOT trusted —
   * whatever is submitted still has to be confirmed by clicking a link sent to it, so a crafted
   * URL can prefill a box and achieve nothing else. And the page looks identical whether or not the
   * address already has an account, because saying otherwise here would turn the front door into a
   * way to ask us who banks with us.
   */
  const { email } = await searchParams;
  const { t, locale } = await i18n();
  const s = t(signupDict);
  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{s.hero.tagline}</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">
            {s.hero.title}
          </h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">
            {s.hero.body}
          </p>
          <ul className="mt-5 space-y-1.5 text-[13px] text-white/70">
            <li>{s.hero.points[0]}</li>
            {/*
              ⚠️ "All three" without this line reads as "we are about to charge you for three
              products". The founder's own framing: show them everything, then let them keep what
              they actually used. It is also literally true — trials end per product, and the
              invoice prices only the entitlements that remain.
            */}
            <li>{s.hero.points[1]}</li>
            {/*
              ⚠️ NOT "commission-free". We charge 2% on RevioDirect bookings
              (`DIRECT_BOOKING_FEE_PCT`), and this is a signup page — the worst possible place for a
              claim a hotel can disprove on its first invoice.

              The true sentence is also the stronger one: 2% against the 15–18% an OTA takes.
              Caught by Codex on 13 Sept while reviewing the live site against the pricing model.
            */}
            <li>{s.hero.points[2]}</li>
            <li>{s.hero.points[3]}</li>
          </ul>
        </div>
        <div className="text-[12px] text-white/40">{s.hero.footer}</div>
      </div>

      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        {translationOn() && <div className="absolute right-4 top-4"><LanguageSwitch locale={locale} label={t(auth).language} /></div>}
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Logo className="h-9 w-9" />
          </div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">{s.title}</h2>
          <p className="mb-5 mt-1 text-[13px] text-ink-500">{s.lead}</p>

          <SignupForm
            defaultEmail={email ?? ""}
            /* Read on the SERVER and passed down. `NEXT_PUBLIC_` would work but puts the key in
               every client bundle in the app; this one page needs it. Absent = no widget, and the
               action is permissive to match, which is what lets the code ship before the keys. */
            {...(process.env.TURNSTILE_SITE_KEY ? { siteKey: process.env.TURNSTILE_SITE_KEY } : {})}
          />

          <p className="mt-5 text-center text-[12.5px] text-ink-500">
            {s.haveAccount}{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">{s.signIn}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
