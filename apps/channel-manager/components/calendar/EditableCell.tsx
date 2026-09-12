"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCell } from "@/lib/actions-calendar";

type Kind = "availability" | "price" | "restriction" | "flag";

export function EditableCell({
  roomTypeId, date, field, kind, value, flag, prefix = "", warn, ratePlanId, past = false,
}: {
  roomTypeId: string;
  date: string;
  /** Which plan's row this cell belongs to. Required on a price row — see `editablePlanId`. */
  ratePlanId?: string;
  field: "inventory" | "price" | "minLos" | "cta" | "ctd" | "stopSell";
  kind: Kind;
  value: string;
  flag?: "stop" | "ctd" | "cta";
  prefix?: string;
  /** Non-blocking attention note (e.g. allotment above the physical room count). */
  warn?: string;
  /**
   * This night has already gone.
   *
   * The month view deliberately shows 45 days back — looking at what a past week was priced at is
   * a normal thing to do. But looking is not editing: the server refuses a write to a past date
   * (`saveCell`), and a cell that accepts a click, opens an input, takes a number and *then*
   * produces an error has wasted the user's time and taught them nothing. Say it before it is read
   * — the cell simply is not a control.
   */
  past?: boolean;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit(raw: string) {
    const clean = kind === "price" ? raw.replace(/[^0-9.]/g, "") : raw;
    start(async () => {
      await saveCell({ roomTypeId, date, field, value: clean, ...(ratePlanId ? { ratePlanId } : {}) });
      setEditing(false);
    });
  }

  /*
   * A gone night renders as text, not as a button: no hover, no cursor, no focus stop. It still
   * shows its value, because the value is history worth reading.
   */
  if (past) {
    if (kind === "flag") {
      const on = !!flag;
      const dot = field === "stopSell" ? "bg-danger-500" : field === "ctd" ? "bg-accent-500" : "bg-brand-600";
      return (
        <span className="flex h-7 w-full items-center justify-center opacity-45" title="This date has passed">
          {on ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} /> : <span className="text-ink-300">·</span>}
        </span>
      );
    }
    return (
      <span
        title="This date has passed — rates and availability can only be changed from today onwards"
        className="flex h-7 w-full items-center justify-center text-ink-400"
      >
        {value === "—" ? "—" : `${prefix}${value}`}
      </span>
    );
  }

  // Flags — click toggles immediately.
  if (kind === "flag") {
    const on = !!flag;
    const dot = field === "stopSell" ? "bg-danger-500" : field === "ctd" ? "bg-accent-500" : "bg-brand-600";
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => commit(on ? "false" : "true")}
        aria-pressed={on}
        className={`flex h-7 w-full items-center justify-center rounded transition-colors hover:bg-brand-50 ${pending ? "opacity-50" : ""}`}
      >
        {on ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} /> : <span className="text-ink-300">·</span>}
      </button>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        defaultValue={value === "—" ? "" : value.replace(/[^0-9.]/g, "")}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-7 w-full rounded border border-brand-600 bg-white px-1 text-center text-[13px] tabular-nums outline-none"
      />
    );
  }

  const tone =
    kind === "availability"
      ? (() => {
          const n = Number(value);
          return n <= 0 ? "text-danger-500" : n <= 5 ? "text-warning-600" : "text-success-600";
        })()
      : kind === "price"
        ? "text-ink-900 font-semibold"
        : value === "—"
          ? "text-ink-300"
          : "text-ink-700 font-semibold";

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={warn}
      className={`flex h-7 w-full items-center justify-center gap-0.5 rounded transition-colors hover:bg-brand-50 ${kind === "availability" ? "font-bold" : ""} ${warn ? "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/40" : tone} ${pending ? "opacity-50" : ""}`}
    >
      {value === "—" ? "—" : `${prefix}${value}`}
      {warn && <span aria-hidden className="text-[10px] leading-none">⚠</span>}
    </button>
  );
}
