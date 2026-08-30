import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { TwoFactorForm } from "@/components/auth/TwoFactorForm";
import { readPendingTwoFactor } from "@/lib/auth";

export const metadata = { title: "Two-factor · RevioCRS" };

/**
 * Step two of signing in.
 *
 * Reachable only with a valid pending token — a correct password and nothing else. Landing here
 * without one means the five-minute window lapsed or somebody navigated straight to the URL, and
 * both get the same answer: back to the start. There is no state worth preserving, because a
 * password proven six minutes ago is not proven now.
 */
export default async function TwoFactorPage() {
  const pending = await readPendingTwoFactor();
  if (!pending) redirect("/login");

  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio<span className="text-product-mark">CRS</span></div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Central Reservations</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">One more step.</h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">
            This account can change your rates and read your guests, so a password on its own is not
            enough to open it.
          </p>
        </div>
        <div className="text-[12px] text-white/40">© Revio</div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Logo className="h-9 w-9" /></div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">Two-factor authentication</h2>
          <p className="mb-6 mt-1 text-[13px] text-ink-500">Your password was accepted.</p>
          <TwoFactorForm />
        </div>
      </div>
    </div>
  );
}
