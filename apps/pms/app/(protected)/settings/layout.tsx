import type { ReactNode } from "react";
import { SettingsNav } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { getPmsSettings } from "@/lib/data";
import { SETTINGS_SECTIONS, SETTINGS_ELSEWHERE } from "./sections";

/**
 * The Settings shell: one header, the section nav, and whichever section is open.
 *
 * The same component and the same shape as RevioLink and RevioCRS. A hotel running two products
 * should not have to learn Settings twice — which is most of the argument for sharing the nav
 * rather than building a third one here.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { property } = await getPmsSettings();

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
