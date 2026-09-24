import type { ReactNode } from "react";
import { fill, translate, type Locale } from "./i18n";
import { helpSections, helpStrings } from "./help-strings";
import { PageHeader } from "./primitives";
import { SettingsNav } from "./settings-nav";

/**
 * Help's frame: sections down the side, the open one on the right — the shape Settings has, on
 * purpose. The founder's words: Help and Your requests "on the left, and the windows on the right".
 *
 * It replaced two tabs across the top. Tabs over a page put the choice where the content starts;
 * a side list keeps both destinations in view while you read either, and it is the shape a hotel has
 * already learned from Settings in the same product.
 *
 * One component for the three products — a hotel running two should not meet two shapes for one job.
 * The app supplies the counts, because the rows are read through its own session.
 */
export function HelpFrame({
  productName,
  counts,
  locale = "en",
  children,
}: {
  productName: string;
  counts: { total: number; open: number };
  locale?: Locale;
  children: ReactNode;
}) {
  const t = translate(helpStrings, locale);
  return (
    <div className="space-y-5">
      <PageHeader title={t.title} subtitle={fill(t.intro, { product: productName })} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={helpSections(t, counts)} labels={{ nav: t.nav.aria, elsewhere: "" }} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Counted the one way the operator's queue counts them: open while it is our turn. */
export function helpCounts(rows: { handledAt: Date | null }[]): { total: number; open: number } {
  return { total: rows.length, open: rows.filter((r) => r.handledAt === null).length };
}
