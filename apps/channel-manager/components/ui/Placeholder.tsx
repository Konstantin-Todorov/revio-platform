import type { ReactNode } from "react";
import { PageHeader } from "./primitives";

export function Placeholder({
  title,
  subtitle,
  icon,
  points,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  points: string[];
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-white px-6 py-16 text-center shadow-card">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
        <h2 className="text-[16px] font-bold text-ink-900">Wired to data — screen lands in this build</h2>
        <p className="mt-1.5 max-w-md text-[13px] text-ink-500">
          The data and the {""}
          <span className="font-semibold text-ink-700">@revio/core</span> logic behind this screen already
          exist and are seeded. The interface is next in the build order.
        </p>
        <ul className="mt-5 grid max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12.5px] text-ink-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
