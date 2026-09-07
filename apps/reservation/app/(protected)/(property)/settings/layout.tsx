import type { ReactNode } from "react";
import { getProperty } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsNav } from "./SettingsNav";

/**
 * The Settings shell: one header, the section nav, and whichever section is open.
 *
 * The header lives here rather than in each page so the five sections cannot drift apart in title,
 * spacing or property name — the failure that made the single page feel assembled rather than
 * designed in the first place.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const property = await getProperty();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle={property.name} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
