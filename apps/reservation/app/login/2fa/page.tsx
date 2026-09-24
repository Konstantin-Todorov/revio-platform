import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/Logo";
import { TwoFactorForm } from "@/components/auth/TwoFactorForm";
import { readPendingTwoFactor } from "@/lib/auth";
import { LanguageSwitch } from "@/components/auth/LanguageSwitch";
import { i18n } from "@/lib/i18n/server";
import { auth } from "@/lib/i18n/auth";

export async function generateMetadata() {
  return { title: (await i18n()).t(auth).twoFactor.meta };
}

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
  const { t: tr, locale } = await i18n();
  const a = tr(auth);
  const t = a.twoFactor;

  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio<span className="text-product-mark">CRS</span></div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{t.tagline}</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">{t.headline}</h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">
            {t.pitch}
          </p>
        </div>
        <div className="text-[12px] text-white/40">© Revio</div>
      </div>

      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="absolute right-4 top-4"><LanguageSwitch locale={locale} label={a.language} /></div>
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Logo className="h-9 w-9" /></div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">{t.title}</h2>
          <p className="mb-6 mt-1 text-[13px] text-ink-500">{t.intro}</p>
          <TwoFactorForm t={a.forms} />
        </div>
      </div>
    </div>
  );
}
