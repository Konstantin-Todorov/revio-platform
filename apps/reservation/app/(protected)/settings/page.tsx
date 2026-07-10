import Link from "next/link";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { getSession } from "@/lib/session";
import { deletePermissionRole, deleteTaxFee, savePermissionRole, saveTaxFee } from "@/lib/actions-settings";
import { savePropertyDefaults } from "@/lib/actions-rates";
import { PRECEDENCE_LINE } from "@revio/core";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { Card, CardHeader, PageHeader, StatusPill } from "@/components/ui/primitives";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none transition-colors focus:border-brand-600";
const labelCls = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400";

const GROUP_LABEL: Record<string, string> = {
  reservations: "Reservations", rates: "Rates", inventory: "Inventory", restrictions: "Restrictions",
  users: "Users", reports: "Reports", distribution: "Distribution", finance: "Finance",
};

export default async function SettingsPage() {
  const property = await getProperty();
  const session = await getSession();
  const [roles, users, taxes, defaults] = await Promise.all([
    prisma.permissionRole.findMany({
      where: { tenantId: property.tenantId },
      include: { access: true },
      orderBy: [{ builtin: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({ where: { tenantId: property.tenantId }, orderBy: { name: "asc" } }),
    prisma.taxFee.findMany({ where: { propertyId: property.id }, orderBy: { name: "asc" } }),
    prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
  ]);

  const levelOf = (role: (typeof roles)[number], group: string) =>
    role.access.find((a) => a.group === group)?.level ?? "none";

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle={`${property.name} · standing policy defaults, permissions, taxes & fees, property profile`} />

      {/* Standing policy defaults (spec §3.9) — the property-default tier of the two-tier
          precedence model, moved here from the dissolved Rates & Restrictions screen. */}
      <Card>
        <CardHeader title="Standing policy defaults — the catch-all tier" subtitle={`Precedence: ${PRECEDENCE_LINE}`} />
        <form action={savePropertyDefaults} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-4">
          <div><label className={labelCls}>Min stay (nights)</label><input type="number" name="defMinLos" min={0} defaultValue={defaults?.defMinLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Max stay (nights)</label><input type="number" name="defMaxLos" min={0} defaultValue={defaults?.defMaxLos ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≥ days ahead</label><input type="number" name="defAdvancePurchaseMin" min={0} defaultValue={defaults?.defAdvancePurchaseMin ?? ""} placeholder="—" className={inputCls} /></div>
          <div><label className={labelCls}>Book ≤ days ahead</label><input type="number" name="defAdvancePurchaseMax" min={0} defaultValue={defaults?.defAdvancePurchaseMax ?? ""} placeholder="—" className={inputCls} /></div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defStopSell" defaultChecked={defaults?.defStopSell ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Stop sell
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCta" defaultChecked={defaults?.defCta ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to arrival
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="defCtd" defaultChecked={defaults?.defCtd ?? false} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Closed to departure
          </label>
          <div><label className={labelCls}>Hold TTL (minutes)</label><input type="number" name="holdTtlMinutes" min={5} max={240} defaultValue={defaults?.holdTtlMinutes ?? 30} className={inputCls} /></div>
          <div><label className={labelCls}>Low-availability alert ≤</label><input type="number" name="lowAvailabilityThreshold" min={0} defaultValue={defaults?.lowAvailabilityThreshold ?? 2} className={inputCls} /></div>
          <div><label className={labelCls}>Pickup compares vs (days ago)</label><input type="number" name="pickupOffsetDays" min={1} max={90} defaultValue={defaults?.pickupOffsetDays ?? 7} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Revenue display</label>
            <select name="revenueDisplay" defaultValue={defaults?.revenueDisplay ?? "gross"} className={inputCls}>
              <option value="gross">Gross</option>
              <option value="net">Net (− channel commission)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" name="countNoShowsAsSold" defaultChecked={defaults?.countNoShowsAsSold ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> Count no-shows as sold
          </label>
          <div className="col-span-2 flex justify-end lg:col-span-4">
            <button className="rounded-md bg-brand-800 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Save defaults</button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Users & Permissions — roles are saved group×level combinations" />
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Role</th>
                {PERMISSION_GROUPS.map((g) => <th key={g} className="px-2 py-2.5 text-center">{GROUP_LABEL[g]}</th>)}
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="group border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-semibold text-ink-900">{role.name}</span>
                    {role.builtin && <span className="ml-1.5 rounded bg-surface-sunken px-1 text-[9.5px] font-bold uppercase text-ink-400">built-in</span>}
                  </td>
                  {PERMISSION_GROUPS.map((g) => {
                    const level = levelOf(role, g);
                    return (
                      <td key={g} className="px-2 py-2 text-center">
                        <span className={`inline-block min-w-[38px] rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${
                          level === "edit" ? "bg-success-50 text-success-600" : level === "view" ? "bg-brand-50 text-brand-700" : "text-ink-300"
                        }`}>
                          {level}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right">
                    {!role.builtin && (
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">
                        <DeleteButton action={deletePermissionRole} id={role.id} label={role.name} note="Users keep their assignment until changed." />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="border-t border-surface-border/60">
          <summary className="cursor-pointer px-4 py-2.5 text-[12.5px] font-semibold text-brand-700 hover:bg-surface-muted">
            + Add a custom role
          </summary>
          <form action={savePermissionRole} className="grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
              <label className={labelCls}>Role name</label>
              <input name="name" required placeholder="e.g. Front Desk" className={inputCls} />
            </div>
            {PERMISSION_GROUPS.map((g) => (
              <div key={g}>
                <label className={labelCls}>{GROUP_LABEL[g]}</label>
                <select name={`level_${g}`} defaultValue="none" className={inputCls}>
                  <option value="none">None</option>
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
              </div>
            ))}
            <button className="h-[34px] rounded-md bg-brand-800 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Create role</button>
          </form>
        </details>
      </Card>

      <Card>
        <CardHeader title={`Staff (${users.length})`} />
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              {["Name", "Email", "Role"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-surface-border/60 last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink-900">{u.name}{u.id === session?.userId && <StatusPill tone="info">you</StatusPill>}</td>
                <td className="px-4 py-2.5 text-ink-600">{u.email}</td>
                <td className="px-4 py-2.5 text-ink-600">{u.role.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Staff invitations and role changes are managed in RevioLink → User Management — one account works across every
          Revio product the hotel owns.
        </p>
      </Card>

      <Card>
        <CardHeader title="Taxes & Fees" />
        {taxes.length > 0 && (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-border text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                {["Name", "Amount", "Basis", "In displayed rate?", "Status"].map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {taxes.map((t) => (
                <tr key={t.id} className="group border-b border-surface-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{t.name}</td>
                  <td className="tnum px-4 py-2.5 text-ink-700">{t.type === "percent" ? `${t.pct}%` : money(t.amountMinor ?? 0, property.baseCurrency)}</td>
                  <td className="px-4 py-2.5 text-ink-600">{t.basis.replace("_", " ")}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={t.inclusion === "included" ? "info" : "neutral"}>{t.inclusion}</StatusPill></td>
                  <td className="px-4 py-2.5"><StatusPill tone={t.active ? "success" : "neutral"}>{t.active ? "active" : "off"}</StatusPill></td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DeleteButton action={deleteTaxFee} id={t.id} label={t.name} note="Existing reservations keep their recorded totals." />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={saveTaxFee} className="grid grid-cols-2 items-end gap-3 border-t border-surface-border/60 p-4 lg:grid-cols-7">
          <div><label className={labelCls}>Name</label><input name="name" required placeholder="City tax" className={inputCls} /></div>
          <div>
            <label className={labelCls}>Type</label>
            <select name="type" defaultValue="fixed" className={inputCls}><option value="fixed">Fixed</option><option value="percent">Percent</option></select>
          </div>
          <div><label className={labelCls}>Amount ({property.baseCurrency})</label><input type="number" step="0.01" min="0" name="amount" placeholder="1.50" className={inputCls} /></div>
          <div><label className={labelCls}>Percent</label><input type="number" step="0.1" min="0" name="pct" placeholder="9" className={inputCls} /></div>
          <div>
            <label className={labelCls}>Basis</label>
            <select name="basis" defaultValue="per_person" className={inputCls}>
              <option value="per_room">Per room</option><option value="per_person">Per person</option>
              <option value="per_night">Per night</option><option value="per_stay">Per stay</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Displayed rate</label>
            <select name="inclusion" defaultValue="excluded" className={inputCls}><option value="excluded">Excluded</option><option value="included">Included</option></select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
              <input type="checkbox" name="active" defaultChecked className="h-3.5 w-3.5 rounded border-surface-border text-brand-600" /> Active
            </label>
            <button className="h-[34px] rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700">Add</button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Property & platform" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px] lg:grid-cols-4">
          <dt className="text-ink-400">Property</dt><dd className="font-semibold text-ink-900">{property.name}</dd>
          <dt className="text-ink-400">Time zone</dt><dd className="text-ink-700">{property.timezone}</dd>
          <dt className="text-ink-400">Currency</dt><dd className="text-ink-700">{property.baseCurrency}</dd>
          <dt className="text-ink-400">Check-in / out</dt><dd className="tnum text-ink-700">{property.checkInTime} / {property.checkOutTime}</dd>
        </dl>
        <p className="border-t border-surface-border/60 px-4 py-2.5 text-[11.5px] text-ink-400">
          Profile & currency are edited in RevioLink → Settings. Metric defaults (no-shows, gross/net, pickup window,
          alert thresholds, hold TTL) live under <Link href="/rates" className="font-semibold text-brand-700 hover:underline">Rates → Property defaults</Link>.
          Notifications and the API/PMS connection arrive with RevioPMS.
        </p>
      </Card>
    </div>
  );
}
