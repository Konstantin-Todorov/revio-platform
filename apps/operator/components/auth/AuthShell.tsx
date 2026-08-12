import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

/** The plain frame the three account pages share — no nav, no session, one job per screen. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <div className="leading-none">
            <div className="text-[16px] font-bold text-ink-900">Revio Operator</div>
          </div>
        </div>
        <h1 className="text-[20px] font-bold tracking-tight text-ink-900">{title}</h1>
        <p className="mb-6 mt-1 text-[13px] text-ink-500">{intro}</p>
        {children}
        <div className="mt-6 text-[12.5px] text-ink-500">
          {footer ?? (
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
