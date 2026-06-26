import { Logo } from "@/components/shell/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in · Revio Operator" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-stretch bg-surface-muted">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[17px] font-bold">Revio</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-warning-500">Operator</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-sm text-[28px] font-bold leading-tight tracking-tight">Above every hotel.</h1>
          <p className="mt-3 max-w-sm text-[14px] text-white/60">Onboard clients, set which products they bought, and watch the health of every property on the platform.</p>
        </div>
        <div className="text-[12px] text-white/40">© Revio · operator console</div>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Logo className="h-9 w-9" /></div>
          <h2 className="text-[20px] font-bold tracking-tight text-ink-900">Operator sign in</h2>
          <p className="mb-6 mt-1 text-[13px] text-ink-500">Restricted to Revio staff.</p>

          <LoginForm />

          <div className="mt-6 rounded-md border border-dashed border-surface-border bg-white px-3 py-2.5 text-[11.5px] text-ink-500">
            <span className="font-semibold text-ink-700">Demo login:</span> <code className="rounded bg-surface-sunken px-1">operator@revio.app</code> · password <code className="rounded bg-surface-sunken px-1">revio1234</code>
          </div>
        </div>
      </div>
    </div>
  );
}
