import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Start your free trial · Revio" };

/**
 * The front door.
 *
 * Hosted on the RevioLink origin because that is the product we lead with and it already has the
 * public auth surfaces (login, reset, accept-invite) this flow finishes in. **It is not a RevioLink
 * signup** — the account it creates owns all three products, so the page wears the platform's name
 * rather than the product's. When a central login lands at its own origin, this moves there and
 * leaves a redirect.
 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Hotel software</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">
            Three products. One login. One set of rooms and rates.
          </h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">
            Your channel manager, your reservation system and your front desk run on the same inventory — so adding
            the second one later is a switch, not a migration.
          </p>
          <ul className="mt-5 space-y-1.5 text-[13px] text-white/70">
            <li>· 30 days, all three products, no card</li>
            <li>· Your own booking page, commission-free</li>
            <li>· Set up in an afternoon, not a quarter</li>
          </ul>
        </div>
        <div className="text-[12px] text-white/40">© Revio · hotel software</div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Logo className="h-9 w-9" />
          </div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">Start your free trial</h2>
          <p className="mb-5 mt-1 text-[13px] text-ink-500">Thirty days of all three Revio products. No card, no call.</p>

          <SignupForm />

          <p className="mt-5 text-center text-[12.5px] text-ink-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
