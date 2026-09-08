import type { ReactNode } from "react";
import { SettingsNav } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { getSettings } from "@/lib/data";
import { SETTINGS_SECTIONS, SETTINGS_ELSEWHERE } from "./sections";

/**
 * The Settings shell: one header, the section nav, and whichever section is open.
 *
 * The header lives here rather than in each page so the sections cannot drift apart in title,
 * spacing or property name — the failure that made the single page feel assembled rather than
 * designed. Same shape as RevioCRS and RevioPMS, from the same component: somebody running two
 * products should not have to learn Settings twice.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { property } = await getSettings();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle={property.name} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SETTINGS_SECTIONS} elsewhere={SETTINGS_ELSEWHERE} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
