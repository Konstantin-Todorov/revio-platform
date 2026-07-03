import { Logo } from "@/components/shell/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · RevioCRS" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-900 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio<span className="text-warning-500">CRS</span></div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Central Reservations</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">Every booking. One record. Real numbers.</h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">The system of record for every reservation from every source — with occupancy, ADR and RevPAR computed from the truth.</p>
        </div>
        <div className="text-[12px] text-white/40">© Revio · central reservations</div>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo className="h-9 w-9" />
          </div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">Sign in to RevioCRS</h2>
          <p className="mb-6 mt-1 text-[13px] text-ink-500">Welcome back — manage your reservations.</p>

          <LoginForm />

          <div className="mt-6 rounded-md border border-dashed border-surface-border bg-white px-3 py-2.5 text-[11.5px] text-ink-500">
            <span className="font-semibold text-ink-700">Demo logins</span> (password <code className="rounded bg-surface-sunken px-1">revio1234</code>):<br />
            Hotel Sofia → <code className="rounded bg-surface-sunken px-1">admin@hotelsofia.demo</code> · Black Sea Resort → <code className="rounded bg-surface-sunken px-1">owner@blacksea.demo</code>
          </div>
        </div>
      </div>
    </div>
  );
}
