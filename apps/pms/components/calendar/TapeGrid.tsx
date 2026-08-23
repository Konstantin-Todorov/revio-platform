"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import type { TapeRow, TapeDay, BarStatus } from "@/lib/tape-chart";

/**
 * The draggable half of the calendar (§2.5).
 *
 * Drag a bar onto another room's row to move the stay there. Vertical only, deliberately: dragging
 * sideways would change the DATES, and extending a stay re-checks availability and re-prices — a
 * second validation surface that deserves its own flow rather than being smuggled into a gesture.
 * The spec calls drag-to-extend a fast-follow, and this respects that.
 *
 * The drop does not decide anything. It submits the same server action the move form uses, which
 * re-checks the room inside a transaction and refuses a clash. A drag is an easy gesture to make by
 * accident, so it must not be a shortcut past the checks — it is a shortcut past the *navigation*.
 */

const BAR_TONE: Record<BarStatus, string> = {
  arrival: "bg-accent-600 text-white",
  in_house: "bg-brand-700 text-white",
  due_out: "bg-warning-500 text-white",
  overstayed: "bg-danger-600 text-white",
  confirmed: "bg-brand-200 text-brand-900",
  blocked: "bg-ink-300 text-ink-700",
};
const BAR_LABEL: Record<BarStatus, string> = {
  arrival: "Arriving today",
  in_house: "In house",
  due_out: "Due out today",
  overstayed: "Overstayed",
  confirmed: "Confirmed",
  blocked: "Out of order",
};

export interface TapeGridProps {
  rows: TapeRow[];
  dates: string[];
  tapeDays: TapeDay[];
  col: number;
  labelCol: number;
  /** Where to come back to after a move — the current calendar URL, filters and all. */
  returnTo: string;
  moveAction: (fd: FormData) => Promise<void>;
}

export function TapeGrid({ rows, dates, tapeDays, col, labelCol, returnTo, moveAction }: TapeGridProps) {
  type Drag = { assignmentId: string; fromUnitId: string; roomTypeId: string };
  /*
   * The drag lives in a REF, and only a mirror of it in state.
   *
   * `dragover` and `drop` need to know what is being dragged, and a `useState` set in `dragstart`
   * has not necessarily rendered by the time they fire — they are separate events, and nothing
   * guarantees a commit between them. A real mouse drag takes hundreds of milliseconds and gets
   * away with it; a fast one does not, and the failure mode is the worst kind: the drop appears to
   * work, silently does nothing, and only sometimes.
   *
   * The ref updates synchronously and drives every decision. The state exists purely so the
   * highlight re-renders, which is the one thing that does need a render.
   */
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDraggingState] = useState<Drag | null>(null);
  const setDragging = (d: Drag | null) => {
    dragRef.current = d;
    setDraggingState(d);
  };
  const [over, setOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const span = dates.length;
  const gridCols = `${labelCol}px repeat(${span}, ${col}px)`;

  const byFloor = new Map<string, TapeRow[]>();
  for (const r of rows) {
    const key = r.floor ?? "—";
    byFloor.set(key, [...(byFloor.get(key) ?? []), r]);
  }

  function drop(targetUnitId: string) {
    const current = dragRef.current;
    if (!current || current.fromUnitId === targetUnitId) {
      setDragging(null);
      setOver(null);
      return;
    }
    const fd = new FormData();
    fd.set("assignmentId", current.assignmentId);
    fd.set("unitId", targetUnitId);
    fd.set("reason", "request");
    fd.set("from", returnTo);
    setDragging(null);
    setOver(null);
    startTransition(() => void moveAction(fd));
  }

  return (
    <div className={`overflow-x-auto ${pending ? "pointer-events-none opacity-60" : ""}`}>
      <div style={{ minWidth: labelCol + span * col }}>
        <div className="grid border-b border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Room</div>
          {tapeDays.map((d) => (
            <div key={d.date}
              className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""} ${d.today ? "bg-accent-50" : ""}`}>
              <div className={`text-[10px] uppercase ${d.today ? "font-bold text-accent-700" : "text-ink-400"}`}>
                {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
              </div>
              <div className={`text-[12px] font-semibold ${d.today ? "text-accent-700" : "text-ink-700"}`}>{d.date.slice(8)}</div>
            </div>
          ))}
        </div>

        {[...byFloor.entries()].map(([floor, floorRows]) => (
          <div key={floor}>
            <div className="grid border-b border-surface-border bg-surface-muted/60" style={{ gridTemplateColumns: gridCols }}>
              <div className="px-3 py-1 text-[11px] font-bold text-ink-500">
                {floor === "—" ? "No floor set" : `Floor ${floor}`}
                <span className="ml-1.5 font-normal text-ink-400">{floorRows.length}</span>
              </div>
            </div>

            {floorRows.map((row) => {
              // Highlight only rooms the drag could legally land in. Showing every row as a target
              // and then refusing the drop teaches people the feature is unreliable; showing the
              // real ones teaches them the rule.
              const sameType = dragging?.roomTypeId === row.roomTypeId;
              return (
                <div key={row.unitId} className="grid border-b border-surface-border last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <span className="text-[13px] font-semibold text-ink-900">{row.label}</span>
                    <span className="truncate text-[10.5px] text-ink-400">{row.roomTypeName}</span>
                  </div>

                  <div
                    className={`relative col-span-full col-start-2 grid transition-colors ${
                      over === row.unitId ? (sameType ? "bg-accent-100" : "bg-warning-100") : ""
                    }`}
                    style={{ gridTemplateColumns: `repeat(${span}, ${col}px)` }}
                    onDragOver={(e) => {
                      // Read the ref, not the render-time `isTarget`: on a fast drag this fires
                      // before the dragstart state has committed, and bailing here means the drop
                      // never becomes valid.
                      const d = dragRef.current;
                      if (!d || d.fromUnitId === row.unitId) return;
                      // preventDefault on dragover is what marks an element as a valid drop target.
                      // Omit it and the drop event never fires, silently.
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOver(row.unitId);
                    }}
                    onDragLeave={() => setOver((u) => (u === row.unitId ? null : u))}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(row.unitId);
                    }}
                  >
                    {tapeDays.map((d) => (
                      <div key={d.date}
                        className={`h-9 border-l border-surface-border ${d.weekend ? "bg-brand-50/50" : ""} ${d.today ? "bg-accent-50/60" : ""}`} />
                    ))}
                    {row.bars.map((bar) => {
                      const startIdx = dates.indexOf(bar.from);
                      if (startIdx < 0) return null;
                      return (
                        <Link
                          key={`${bar.reservationId}-${bar.from}`}
                          href={`/reservation/${bar.reservationId}`}
                          draggable={bar.movable}
                          onDragStart={(e) => {
                            if (!bar.movable) return;
                            // setData is not optional. Without a payload the browser may refuse to
                            // start the drag at all, and an <a> is natively draggable — its default
                            // payload is the href, so a drop elsewhere would try to navigate.
                            e.dataTransfer.setData("text/plain", bar.assignmentId);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging({ assignmentId: bar.assignmentId, fromUnitId: row.unitId, roomTypeId: row.roomTypeId });
                          }}
                          onDragEnd={() => { setDragging(null); setOver(null); }}
                          title={`${bar.guestName} · ${bar.from} → ${bar.to} · ${BAR_LABEL[bar.status]}${bar.pinned ? " · room pinned" : ""}${bar.movable ? " · drag to another room to move" : ""}`}
                          className={`absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded px-1.5 text-[11px] font-semibold shadow-sm transition-opacity hover:opacity-90 ${BAR_TONE[bar.status]} ${
                            bar.continuesLeft ? "rounded-l-none" : ""
                          } ${bar.continuesRight ? "rounded-r-none" : ""} ${bar.movable ? "cursor-grab active:cursor-grabbing" : ""} ${
                            dragging?.assignmentId === bar.assignmentId ? "opacity-40" : ""
                          }`}
                          style={{ left: startIdx * col + 2, width: bar.nights * col - 4 }}
                        >
                          {bar.pinned && <Pin className="h-2.5 w-2.5 shrink-0 opacity-80" />}
                          <span className="truncate">{bar.guestName}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="grid border-t-2 border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Free · occ.</div>
          {tapeDays.map((d) => (
            <div key={d.date} className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""}`}>
              <div className={`text-[12px] font-bold ${d.availableRooms === 0 ? "text-danger-600" : "text-ink-800"}`}>{d.availableRooms}</div>
              <div className="text-[9.5px] text-ink-400">{d.occupancyPct}%</div>
            </div>
          ))}
        </div>
      </div>

      {dragging && (
        <p className="border-t border-surface-border px-3 py-2 text-[11.5px] text-ink-500">
          Drop on another room to move this stay. A room of a{" "}
          <span className="font-semibold text-warning-700">different type</span> is allowed — the booking does not change,
          but you will be asked what to do about the price difference.
        </p>
      )}
    </div>
  );
}
