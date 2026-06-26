import type { ReactNode } from "react";
import Link from "next/link";

export function EmptyState({
  icon, title, body, actionLabel, actionHref,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-white px-6 py-16 text-center shadow-card">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
      <h2 className="text-[16px] font-bold text-ink-900">{title}</h2>
      <p className="mt-1.5 max-w-md text-[13px] text-ink-500">{body}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-5 rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
