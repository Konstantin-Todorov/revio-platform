"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCell } from "@/lib/actions-calendar";

type Kind = "availability" | "price" | "restriction" | "flag";

export function EditableCell({
  roomTypeId, date, field, kind, value, flag, prefix = "",
}: {
  roomTypeId: string;
  date: string;
  field: "inventory" | "price" | "minLos" | "ctd" | "stopSell";
  kind: Kind;
  value: string;
  flag?: "stop" | "ctd" | "cta";
  prefix?: string;
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
      await saveCell({ roomTypeId, date, field, value: clean });
      setEditing(false);
    });
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
      className={`flex h-7 w-full items-center justify-center rounded transition-colors hover:bg-brand-50 ${kind === "availability" ? "font-bold" : ""} ${tone} ${pending ? "opacity-50" : ""}`}
    >
      {value === "—" ? "—" : `${prefix}${value}`}
    </button>
  );
}
