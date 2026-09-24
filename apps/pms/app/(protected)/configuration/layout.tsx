import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SettingsNav, type SettingsSection } from "@revio/ui/settings-nav";
import { PageHeader } from "@/components/ui/primitives";
import { activeProperty } from "@/lib/data";
import { MANAGER_ROLES } from "@/lib/roles";
import { i18n } from "@/lib/i18n/server";
import { configuration, type ConfigSectionKey } from "@/lib/i18n/configuration";

const SECTIONS: { href: string; key: ConfigSectionKey }[] = [
  { href: "/configuration", key: "taxes" },
  { href: "/configuration/invoices", key: "invoices" },
  { href: "/configuration/deposits", key: "deposits" },
  { href: "/configuration/housekeeping", key: "housekeeping" },
  { href: "/configuration/end-of-day", key: "endOfDay" },
  { href: "/configuration/compliance", key: "compliance" },
  { href: "/configuration/outlets", key: "outlets" },
];
const LINKS = [
  { href: "/minibar/catalog", key: "catalog" },
  { href: "/rooms", key: "rooms" },
  { href: "/users", key: "staff" },
  { href: "/settings", key: "settings" },
] as const;

/**
 * Configuration in the Settings shape (docs/UI-STANDARD.md §8): one section per thing a manager comes
 * here to set. It was eight cards on one scroll — taxes, issuer, housekeeping, end of day, compliance,
 * one save for those five, then deposits, series and outlets — and the thing you came for was usually
 * card six. Each section is now one card whose save is its last line.
 */
export default async function ConfigurationLayout({ children }: { children: ReactNode }) {
  const { session, property } = await activeProperty();
  const { t: tr } = await i18n();
  const t = tr(configuration);

  if (!MANAGER_ROLES.has(session.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600"><Lock className="h-6 w-6" /></div>
        <h1 className="text-[16px] font-bold text-ink-900">{t.lockedTitle}</h1>
        <p className="mt-1 text-[13px] text-ink-500">{t.lockedBody}</p>
      </div>
    );
  }

  const sections: SettingsSection[] = SECTIONS.map((s) => ({ href: s.href, ...t.nav.sections[s.key] }));
  const elsewhere: SettingsSection[] = LINKS.map((s) => ({ href: s.href, ...t.nav.links[s.key] }));
  return (
    <div className="space-y-5">
      <PageHeader title={t.title} subtitle={t.subtitle(property.name)} />
      <div className="flex flex-col gap-5 lg:flex-row">
        <SettingsNav sections={sections} elsewhere={elsewhere} labels={{ nav: t.nav.aria, elsewhere: t.nav.elsewhere }} />
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
}
