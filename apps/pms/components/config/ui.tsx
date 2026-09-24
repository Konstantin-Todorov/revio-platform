import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { saveConfiguration } from "@/lib/actions-config";

export const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";
export const labelCls = "mb-1 block text-[11px] font-semibold text-ink-600";

/**
 * One Configuration section: a card, its fields, and its save as the last line. `section` tells
 * `saveConfiguration` which fields this form carries, so saving here writes nothing else.
 */
export function ConfigSectionForm({ section, title, subtitle, save, children }: {
  section: "taxes" | "invoices" | "housekeeping" | "endOfDay" | "compliance";
  title: string;
  subtitle: string;
  save: string;
  children: ReactNode;
}) {
  return (
    <form action={saveConfiguration}>
      <input type="hidden" name="section" value={section} />
      <Card>
        <CardHeader title={title} subtitle={subtitle} />
        {children}
        <div className="flex justify-end border-t border-surface-border px-4 py-3">
          <button className="rounded-md bg-brand-800 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700">{save}</button>
        </div>
      </Card>
    </form>
  );
}
