"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, User } from "lucide-react";
import type { TapeRow, TapeDay, BarStatus, TapeBar } from "@/lib/tape-chart";
import { StayModal } from "./StayModal";
import { fill, LOCALE_LABELS } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { moneyIn } from "@/lib/i18n/money";
import type { CalendarGridStrings } from "@/lib/i18n/calendar";

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
export interface TapeGridProps {
  rows: TapeRow[];
  dates: string[];
  tapeDays: TapeDay[];
  col: number;
  labelCol: number;
  /** Where to come back to after a move — the current calendar URL, filters and all. */
  returnTo: string;
  moveAction: (fd: FormData) => Promise<{ moved: true; crossType: boolean; reservationId: string } | void>;
  /** Reads the pending price difference after a cross-type drop, so the prompt can open in place. */
  assessAction: (reservationId: string) => Promise<MoveAssessmentDto | null>;
  /** Strings only — see `CalendarGridStrings`. */
  t: CalendarGridStrings;
}

/** Only what the prompt renders — the shape `assessMoveForReservation` returns. */
export interface MoveAssessmentDto {
  kind: string;
  direction: string;
  differenceMinor: number;
  nights: string[];
  options: string[];
  currency: string;
  bookedRoomTypeName: string;
  accommodatedRoomTypeName: string;
  unitLabel: string;
}

/** Would the dragged stay collide with anything already in this row? */
function occupiedDuring(row: TapeRow, bar: TapeBar): boolean {
  return row.bars.some((b) => b.assignmentId !== bar.assignmentId && b.from <= bar.to && bar.from <= b.to);
}

export function TapeGrid({ rows, dates, tapeDays, col, labelCol, returnTo, moveAction, assessAction, t }: TapeGridProps) {
  const locale = useLocale();
  const money = moneyIn(locale);
  const count = (n: number, one: string, many: string) => fill(n === 1 ? one : many, { n });
  type Drag = { assignmentId: string; fromUnitId: string; roomTypeId: string; bar: TapeBar };
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
  const [openBar, setOpenBar] = useState<TapeBar | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState<MoveAssessmentDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  // A drag ends with a click on most browsers. Without this the bar you just dropped immediately
  // opens its own dialog — which reads as the app doing something you did not ask for.
  const draggedAt = useRef(0);
  const assessmentReservationId = useRef<string | null>(null);

  const span = dates.length;
  const gridCols = `${labelCol}px repeat(${span}, ${col}px)`;

  const byFloor = new Map<string, TapeRow[]>();
  for (const r of rows) {
    const key = r.floor ?? "—";
    byFloor.set(key, [...(byFloor.get(key) ?? []), r]);
  }

  async function drop(targetUnitId: string) {
    const current = dragRef.current;
    if (!current || current.fromUnitId === targetUnitId) {
      setDragging(null);
      setOver(null);
      return;
    }
    const target = rows.find((r) => r.unitId === targetUnitId);
    const fd = new FormData();
    fd.set("assignmentId", current.assignmentId);
    fd.set("unitId", targetUnitId);
    fd.set("reason", "request");
    fd.set("from", returnTo);
    setDragging(null);
    setOver(null);
    setBusy(true);
    try {
      const result = await moveAction(fd);
      // Refresh the server components in place. No navigation, so the scroll position, the date
      // window and everything else the user had set up survive the move (§2.6).
      startTransition(() => router.refresh());
      if (result && result.crossType) {
        // The price question opens HERE rather than on another screen. The spec calls it a prompt,
        // and §2.6's rule is that the grid is a place you work from, not a signpost.
        const a = await assessAction(result.reservationId);
        assessmentReservationId.current = result.reservationId;
        if (a && a.kind === "rate_affecting") setAssessment(a);
      } else {
        setToast(fill(t.movedTo, { room: target ? fill(t.roomNamed, { room: target.label }) : t.theNewRoom }));
        window.setTimeout(() => setToast(null), 2600);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`overflow-x-auto transition-opacity ${pending || busy ? "pointer-events-none opacity-60" : ""}`}>
      <div style={{ minWidth: labelCol + span * col }}>
        <div className="grid border-b border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{t.room}</div>
          {tapeDays.map((d) => (
            <div key={d.date}
              className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""} ${d.today ? "bg-accent-50" : ""}`}>
              <div className={`text-[10px] uppercase ${d.today ? "font-bold text-accent-700" : "text-ink-400"}`}>
                {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(LOCALE_LABELS[locale].intl, { weekday: "short", timeZone: "UTC" })}
              </div>
              <div className={`text-[12px] font-semibold ${d.today ? "text-accent-700" : "text-ink-700"}`}>{d.date.slice(8)}</div>
            </div>
          ))}
        </div>

        {[...byFloor.entries()].map(([floor, floorRows]) => (
          <div key={floor}>
            <div className="grid border-b border-surface-border bg-surface-muted/60" style={{ gridTemplateColumns: gridCols }}>
              <div className="px-3 py-1 text-[11px] font-bold text-ink-500">
                {/* A floor is a named object now ("Floor 1", "Ground", "Annex"), so only a bare number
                    gets the prefix — "Floor Floor 1" was on screen in both languages. */}
                {floor === "—" ? t.noFloor : /^\d+$/.test(floor) ? fill(t.floor, { floor }) : floor}
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
                    className={`relative col-span-full col-start-2 grid transition-colors duration-150 ${
                      dragging && row.unitId !== dragging.fromUnitId
                        ? occupiedDuring(row, dragging.bar)
                          ? "bg-danger-50/70"          // taken for these nights — the drop will be refused
                          : sameType
                            ? "bg-accent-50"           // same type: an ordinary move
                            : "bg-warning-50"          // another type: allowed, but it changes the price
                        : ""
                    } ${over === row.unitId ? "ring-2 ring-inset ring-accent-500" : ""}`}
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
                    {/* THE LANDING PREVIEW. A drag that only tints a row asks the user to imagine the
                        result; showing the bar where it will actually sit, at its real width and
                        dates, answers the question they are holding the mouse still to ask. */}
                    {dragging && over === row.unitId && row.unitId !== dragging.fromUnitId && (() => {
                      const startIdx = dates.indexOf(dragging.bar.from);
                      if (startIdx < 0) return null;
                      const blocked = occupiedDuring(row, dragging.bar);
                      return (
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded px-1.5 text-[11px] font-semibold ${
                            blocked
                              ? "border-2 border-dashed border-danger-500 bg-danger-100/70 text-danger-700"
                              : "border-2 border-dashed border-accent-600 bg-accent-100/80 text-accent-800"
                          }`}
                          style={{ left: startIdx * col + 2, width: dragging.bar.columns * col - 4 }}
                        >
                          <span className="truncate">
                            {blocked ? t.occupiedNights : dragging.bar.guestName}
                          </span>
                        </div>
                      );
                    })()}

                    {row.bars.map((bar) => {
                      const startIdx = dates.indexOf(bar.from);
                      if (startIdx < 0) return null;
                      return (
                        <button
                          type="button"
                          key={`${bar.reservationId}-${bar.from}`}
                          // Opens the stay over the calendar rather than navigating away (§2.6).
                          // A button, not a link: the destination is a dialog, and telling a screen
                          // reader it is about to follow a link would be a lie.
                          onClick={() => {
                            // A drag ends with a click on most browsers; without this the bar you
                            // just dropped opens its own dialog unasked.
                            if (Date.now() - draggedAt.current < 300) return;
                            setOpenBar(bar);
                          }}
                          draggable={bar.movable}
                          onDragStart={(e) => {
                            if (!bar.movable) return;
                            // setData is not optional. Without a payload the browser may refuse to
                            // start the drag at all, and an <a> is natively draggable — its default
                            // payload is the href, so a drop elsewhere would try to navigate.
                            e.dataTransfer.setData("text/plain", bar.assignmentId);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging({ assignmentId: bar.assignmentId, fromUnitId: row.unitId, roomTypeId: row.roomTypeId, bar });
                          }}
                          onDragEnd={() => { draggedAt.current = Date.now(); setDragging(null); setOver(null); }}
                          title={`${bar.guestName}${bar.occupancy != null ? ` · ${count(bar.occupancy, t.guestOne, t.guestMany)}` : ""} · ${bar.from} → ${bar.to} · ${t.bars[bar.status]}${bar.pinned ? ` · ${t.pinned}` : ""}${bar.movable ? ` · ${t.dragToMove}` : ""}`}
                          className={`absolute inset-y-1 flex items-center gap-1 overflow-hidden rounded px-1.5 text-[11px] font-semibold shadow-sm transition-all duration-150 hover:opacity-90 hover:shadow-md ${BAR_TONE[bar.status]} ${
                            bar.continuesLeft ? "rounded-l-none" : ""
                          } ${bar.continuesRight ? "rounded-r-none" : ""} ${bar.movable ? "cursor-grab active:cursor-grabbing" : ""} ${
                            dragging?.assignmentId === bar.assignmentId ? "opacity-40" : ""
                          }`}
                          style={{ left: startIdx * col + 2, width: bar.columns * col - 4 }}
                        >
                          {bar.pinned && <Pin className="h-2.5 w-2.5 shrink-0 opacity-80" />}
                          <span className="truncate">{bar.guestName}</span>
                          {/* The occupancy badge (§P5): what the stay is priced at. Still no RATE
                              on this chart — that is deliberate (PMS §4.5) and unchanged. */}
                          {bar.occupancy != null && (
                            // A person glyph, not a word: "2p" / "2 чов." cost the guest's name the
                            // space, and the bar's title already says "2 guests" in full.
                            <span className="ml-1 inline-flex shrink-0 items-center gap-px rounded bg-white/25 px-1 text-[9.5px] font-bold leading-4">
                              <User aria-hidden className="h-2.5 w-2.5" />{bar.occupancy}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="grid border-t-2 border-surface-border bg-surface-muted" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{t.freeOcc}</div>
          {tapeDays.map((d) => (
            <div key={d.date} className={`border-l border-surface-border py-1.5 text-center ${d.weekend ? "bg-brand-50" : ""}`}>
              <div className={`text-[12px] font-bold ${d.availableRooms === 0 ? "text-danger-600" : "text-ink-800"}`}>{d.availableRooms}</div>
              <div className="text-[9.5px] text-ink-400">{d.occupancyPct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rendered unconditionally so the dialog's exit animation has something to animate — it
          returns null until it has been given a stay at least once. */}
      <StayModal bar={openBar} open={openBar != null} onClose={() => setOpenBar(null)} money={money} t={t.stay} />

      {/* §2.5's reconciliation PROMPT, on the calendar rather than on another screen. The move has
          already happened — what is open is money, and the spec asks a human to classify it. */}
      {assessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-[15px] font-bold text-ink-900">
              {assessment.direction === "upgrade" ? t.assess.upgraded : assessment.direction === "downgrade" ? t.assess.downgraded : t.assess.moved}
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-600">
              {t.assess.booked} <span className="font-semibold">{assessment.bookedRoomTypeName}</span>{t.assess.nowIn}{" "}
              <span className="font-semibold">{assessment.accommodatedRoomTypeName}</span> {fill(t.assess.roomParen, { room: assessment.unitLabel })}{" "}
              {t.assess.unchanged}
            </p>
            <p className="mt-2 text-[13px]">
              <span className="text-ink-500">{count(assessment.nights.length, t.assess.differenceOne, t.assess.differenceMany)}</span>
              <span className="tnum font-bold text-ink-900">
                {assessment.differenceMinor >= 0 ? "+" : "−"}{money(Math.abs(assessment.differenceMinor), assessment.currency)}
              </span>
            </p>
            <p className="mt-3 text-[12px] text-ink-500">
              {t.assess.decide}
            </p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setAssessment(null)}
                className="rounded-md border border-surface-border px-3 py-2 text-[12.5px] font-semibold text-ink-700 hover:bg-surface-muted"
              >
                {t.assess.later}
              </button>
              <a
                href={`/folio/${assessmentReservationId.current ?? ""}?moved=1`}
                className="rounded-md bg-brand-800 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700"
              >
                {t.assess.settle}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* An ordinary move says so and gets out of the way. Silence after a drag leaves the user
          wondering whether it worked; a dialog for something routine is worse. */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md bg-ink-900 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {dragging && (
        <p className="border-t border-surface-border px-3 py-2 text-[11.5px] text-ink-500">
          {t.dragHintLead}{" "}
          <span className="font-semibold text-warning-700">{t.differentType}</span> {t.dragHintTail}
        </p>
      )}
    </div>
  );
}
