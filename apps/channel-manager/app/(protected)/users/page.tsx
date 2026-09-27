import { getSettings } from "@/lib/data";
import { getSession } from "@/lib/session";
import { removeUser } from "@/lib/actions-users";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { InviteUserDialog, RoleSelect } from "@/components/settings/UserManagement";
import { i18n } from "@/lib/i18n/server";
import { settings as settingsDict } from "@/lib/i18n/settings";

export const dynamic = "force-dynamic";

/** V2 IA: User Management is its own Operations screen (moved out of Settings). */
export default async function Page() {
  const [{ users }, session, { t }] = await Promise.all([getSettings(), getSession(), i18n()]);
  const s = t(settingsDict).users;
  const canManage = session?.role === "owner" || session?.role === "admin";

  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <Card>
        <CardHeader title={s.card} action={<InviteUserDialog canManage={canManage} />} />
        <ul className="divide-y divide-surface-border/60">
          {users.map((u) => {
            const isSelf = u.id === session?.userId;
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11px] font-bold text-white">
                  {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{u.name}{isSelf && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-400">{s.you}</span>}</div>
                  <div className="truncate text-[11px] text-ink-400">{u.email}</div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-1.5">
                    <RoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                    {!isSelf && (
                      <form action={removeUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" aria-label={s.remove(u.name)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600">{s.removeLabel}</button>
                      </form>
                    )}
                  </div>
                ) : (
                  <StatusPill tone="info">{s.roles[u.role as keyof typeof s.roles] ?? u.role.replace(/_/g, " ")}</StatusPill>
                )}
              </li>
            );
          })}
        </ul>
        {!canManage && <div className="border-t border-surface-border px-4 py-2.5 text-[11.5px] text-ink-400">{s.onlyManagers}</div>}
      </Card>
      <p className="mt-3 text-[12px] text-ink-400">
        {s.rolesNote}
      </p>
    </div>
  );
}
