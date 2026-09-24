import Link from "next/link";
import { Plus, Trash2, AlertTriangle, PowerOff, History, Clock, LogIn, LogOut } from "lucide-react";
import { Card, PageHeader, StatusPill, type Tone } from "@/components/ui/primitives";
import { getMaintenanceBoard } from "@/lib/maintenance";
import { createMaintenanceTask, deleteMaintenanceTask } from "@/lib/actions-maintenance";
import { MaintStatusControl } from "@/components/maintenance/MaintStatusControl";
import { TaskPhoto } from "@/components/maintenance/TaskPhoto";
import { getSession } from "@/lib/session";
import { getOpenShift } from "@/lib/workforce";
import { clockInSelf, clockOutSelf } from "@/lib/actions-workforce";
import { i18n } from "@/lib/i18n/server";
import { operations, type OperationsStrings } from "@/lib/i18n/operations";

import { SubmitButton } from "@revio/ui/submit-button";
export const dynamic = "force-dynamic";

const inputCls = "h-9 rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-600";
const PRIORITY_TONE: Record<string, Tone> = { low: "neutral", normal: "info", high: "danger" };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await getSession();
  const o = (await i18n()).t(operations);
  const m = o.maintenance;
  const [{ tasks, units }, openShift] = await Promise.all([
    getMaintenanceBoard(),
    session ? getOpenShift(session.userId) : Promise.resolve(null),
  ]);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <PageHeader title={m.title} subtitle={m.subtitle} />

      {/* Crew clock-in (§8.1 — one shared mechanism with Housekeeping). Availability + light KPI, not payroll. */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 text-[12.5px]">
          <Clock className="h-4 w-4 text-ink-400" />
          {openShift
            ? <span className="font-semibold text-success-700">{o.shift.clockedInSince(openShift.clockInAt.toISOString().slice(11, 16))}</span>
            : <span className="text-ink-500">{o.shift.notClockedIn}</span>}
        </div>
        {openShift ? (
          <form action={clockOutSelf}><button className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted"><LogOut className="h-3.5 w-3.5" /> {o.shift.clockOut}</button></form>
        ) : (
          <form action={clockInSelf}><button className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-500"><LogIn className="h-3.5 w-3.5" /> {o.shift.clockIn}</button></form>
        )}
      </Card>

      {error === "title" && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m.titleError}
        </div>
      )}

      {/* New task */}
      <Card className="mb-4 p-4">
        <h3 className="mb-3 text-[13px] font-bold text-ink-900">{m.newTask}</h3>
        <form action={createMaintenanceTask} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{m.whatsWrong}</span>
            <input name="title" required placeholder={m.whatsWrongPlaceholder} className={`${inputCls} w-52`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{m.roomOptional}</span>
            <select name="unitId" defaultValue="" className={`${inputCls} w-32`}>
              <option value="">{m.none}</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{m.priority}</span>
            <select name="priority" defaultValue="normal" className={`${inputCls} w-24`}>
              <option value="low">{m.priorities.low}</option>
              <option value="normal">{m.priorities.normal}</option>
              <option value="high">{m.priorities.high}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-600">{m.assignee}</span>
            <input name="assignee" placeholder={m.optional} className={`${inputCls} w-28`} />
          </label>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-danger-600">
            <input type="checkbox" name="ooo" className="h-4 w-4 rounded border-surface-border text-danger-600 focus:ring-danger-600" />
            <PowerOff className="h-3.5 w-3.5" /> {m.outOfOrder}
          </label>
          <SubmitButton className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-500" pendingLabel={m.creating}>
            <Plus className="h-3.5 w-3.5" /> {m.add}
          </SubmitButton>
        </form>
        <p className="mt-2 text-[11px] text-ink-400">{m.oooNote}</p>
      </Card>

      {tasks.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-ink-500">{m.empty}</Card>
      ) : (
        <div className="space-y-4">
          <TaskList title={m.open} rows={openTasks} m={m} />
          {doneTasks.length > 0 && <TaskList title={m.done} rows={doneTasks} m={m} />}
        </div>
      )}
    </div>
  );
}

function TaskList({ title, rows, m }: { title: string; rows: Awaited<ReturnType<typeof getMaintenanceBoard>>["tasks"]; m: OperationsStrings["maintenance"] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <div className="border-b border-surface-border px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-ink-400">{title} · {rows.length}</div>
      <ul className="divide-y divide-surface-border">
        {rows.map((t) => (
          <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 ${t.status === "done" ? "opacity-60" : ""}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-ink-900">{t.title}</span>
                <StatusPill tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{m.priorities[t.priority as keyof typeof m.priorities] ?? t.priority}</StatusPill>
                {t.setsOoo && <span className="inline-flex items-center gap-1 rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-danger-600"><PowerOff className="h-3 w-3" />OOO</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
                <span>{t.unit ? m.room(t.unit.label, t.unit.roomType.name) : m.noRoom}{t.assignee ? ` · ${t.assignee}` : ""}</span>
                {t.unit && (
                  <Link href={`/rooms/${t.unit.id}`} className="inline-flex items-center gap-1 font-semibold text-accent-600 hover:underline">
                    <History className="h-3 w-3" /> {m.roomHistory}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TaskPhoto id={t.id} photoUrl={t.photoUrl} t={m.photo} />
              <MaintStatusControl id={t.id} status={t.status} t={{ aria: m.statusAria, ...m.statuses }} />
              <form action={deleteMaintenanceTask}>
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton aria-label={m.delete} title={m.delete} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
