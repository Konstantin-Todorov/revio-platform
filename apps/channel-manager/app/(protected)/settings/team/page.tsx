import Link from "next/link";
import { Users } from "lucide-react";
import { getSettings } from "@/lib/data";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** Who is on this account. The editing itself lives on `/users`, which owns that URL. */
export default async function TeamSettingsPage() {
  const { users } = await getSettings();

  return (
    <>
      <Card>
        <CardHeader title="Team" />
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <Users className="h-4 w-4" />
            </span>
            <div className="flex-1 text-[12.5px] text-ink-500">
              {users.length} user{users.length === 1 ? "" : "s"} on this account
            </div>
            <Link
              href="/users"
              className="rounded-md border border-surface-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
            >
              Manage users
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Connect another system" />
        <div className="px-4 py-4 text-[12.5px] text-ink-500">
          Already running a different PMS? We can connect it to RevioLink so your availability stays in
          one place. Talk to us and we&rsquo;ll set it up with you.
        </div>
      </Card>
    </>
  );
}
