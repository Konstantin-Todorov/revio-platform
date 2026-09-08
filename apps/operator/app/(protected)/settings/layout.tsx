import type { ReactNode } from "react";
import { SettingsNav } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { SETTINGS_SECTIONS, SETTINGS_ELSEWHERE } from "./sections";

/**
 * The Settings shell: one header, the section nav, and whichever section is open.
 *
 * The same component and the same shape the three hotel products use. This console is not a hotel
 * product, but the person opening it is often the same person who has just been in one of them, and
 * a fourth arrangement of the same job helps nobody.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Operator team, roles and platform configuration" />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={SETTINGS_SECTIONS} elsewhere={SETTINGS_ELSEWHERE} />
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </div>
  );
}
