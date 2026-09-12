import Link from "next/link";
import { KeyRound, LifeBuoy, LogIn } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { productOrigin } from "@revio/ui/product-links";

export const metadata = { title: "You already have an account · Revio" };

/**
 * The end of the road for a second free trial, said kindly.
 *
 * ## Why this screen exists at all
 *
 * A hotel that trialled RevioCRS and RevioPMS, did not buy them, and comes back to the signup form
 * four months later must not be handed another thirty days. That is the gap the founder named, and
 * closing it in the database is only half the job: the person in front of the form is almost never
 * an abuser. They are usually somebody who forgot they already have an account, and the screen they
 * meet decides whether they reach their own data or give up.
 *
 * So it does three things, in the order they are likely to be needed: sign in, recover a forgotten
 * password, or reach a human. It never says what they were trying to do was wrong.
 *
 * ## What it does not say
 *
 * It does not name the hotel, the products they have, which trials they have used, or when. Anyone
 * can reach this page by typing an address into a public form, so everything on it must be safe to
 * show a stranger who guessed correctly. "You already have an account" is the most it may say —
 * and see `signupVerdict` for why saying even that is a considered trade rather than an oversight.
 */
export default async function SignupExistingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const suspended = reason === "suspended";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-md">
        <Logo className="mx-auto h-9 w-9" />

        <div className="mt-6 rounded-xl border border-surface-border bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <KeyRound className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">
            You already have a Revio account
          </h1>

          {suspended ? (
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">
              That email belongs to an account that is currently paused. Your data is all still
              there — get in touch and we will switch it back on.
            </p>
          ) : (
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">
              That email is already set up, so there is nothing to start — just sign in and
              everything is where you left it.
            </p>
          )}

          {!suspended && (
            <>
              <Link
                href="/login"
                className="mt-5 flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-brand-800 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
              <p className="mt-3 text-[12.5px] text-ink-500">
                Forgotten your password?{" "}
                <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
                  Reset it
                </Link>
              </p>
            </>
          )}

          <div className="mt-5 border-t border-surface-border pt-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Signing in to a different product?
            </p>
            {/*
              The chooser, in miniature. Somebody who arrived here was trying to reach SOMETHING,
              and which of the three it was is a question only they can answer — so all three are
              offered rather than guessed at. The main button above goes to RevioLink because that
              is the origin this page is served from.
            */}
            <ul className="mt-2 space-y-1">
              {[
                { key: "cm" as const, name: "RevioLink", what: "Channels and availability" },
                { key: "crs" as const, name: "RevioCRS", what: "Reservations and rates" },
                { key: "pms" as const, name: "RevioPMS", what: "Front desk and housekeeping" },
              ].map((p) => (
                <li key={p.key}>
                  <a
                    href={`${productOrigin(p.key)}/login`}
                    className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-muted"
                  >
                    <span className="font-semibold text-brand-700">{p.name}</span>
                    <span className="text-ink-400">{p.what}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-ink-500">
          <LifeBuoy className="h-3.5 w-3.5 text-ink-400" />
          Not sure which account this is?{" "}
          <a href="mailto:support@reviosoft.app" className="font-semibold text-brand-700 hover:underline">
            Ask us
          </a>
        </p>
      </div>
    </div>
  );
}
