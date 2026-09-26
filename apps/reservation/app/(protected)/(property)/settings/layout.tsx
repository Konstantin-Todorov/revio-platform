import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";
import type { ReactNode } from "react";
import { getProperty } from "@/lib/data";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsNav } from "@revio/ui/settings-nav";
import { settingsNav } from "./sections";

/**
 * The Settings shell: one header, the section nav, and whichever section is open.
 *
 * The header lives here rather than in each page so the five sections cannot drift apart in title,
 * spacing or property name — the failure that made the single page feel assembled rather than
 * designed in the first place.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const property = await getProperty();
  const s = (await i18n()).t(settingsDict);
  const nav = settingsNav(s);

  return (
    <div className="space-y-5">
      <PageHeader title={s.title} subtitle={property.name} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={nav.sections} elsewhere={nav.elsewhere} labels={{ nav: s.navLabel, elsewhere: s.elsewhereLabel }} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
