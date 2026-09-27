import Link from "next/link";
import { Users } from "lucide-react";
import { getSettings } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";
import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";

export const dynamic = "force-dynamic";

/** Who is on this account. The editing itself lives on `/users`, which owns that URL. */
export default async function TeamSettingsPage() {
  const { users } = await getSettings();
  const s = (await i18n()).t(settingsDict).team;

  return (
    <>
      <Card>
        <CardHeader title={s.title} />
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <Users className="h-4 w-4" />
            </span>
            <div className="flex-1 text-[12.5px] text-ink-500">
              {s.count(users.length)}
            </div>
            <Link
              href="/users"
              className="rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
            >
              {s.manage}
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={s.connectTitle} />
        <div className="px-4 py-4 text-[12.5px] text-ink-500">
          {s.connectBody}
        </div>
      </Card>
    </>
  );
}
