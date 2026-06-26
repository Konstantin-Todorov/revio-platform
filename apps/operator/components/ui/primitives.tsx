import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-accent-50 text-accent-600",
  neutral: "bg-surface-sunken text-ink-500",
};
const DOT: Record<Tone, string> = {
  success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500",
  info: "bg-accent-500", neutral: "bg-ink-300",
};

/** Status encoded by dot + label — never colour alone (Atlas rule). */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-surface-border bg-white shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
      <h2 className="text-[13.5px] font-bold tracking-tight text-ink-900">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
