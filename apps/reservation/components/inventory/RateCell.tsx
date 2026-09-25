"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { inventory as inventoryDict } from "@/lib/i18n/inventory";
import { moneyIn } from "@/lib/i18n/money";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCalendarRate } from "@/lib/actions-rates";

/** Inline-editable standard-plan rate in the Inventory Calendar — writes the SAME RatePrice rows
 *  the CM's grid edits (derived plans recalc from it automatically). */
export function RateCell({ roomTypeId, date, value, ratePlanId, note }: {
  roomTypeId: string;
  date: string;
  value: string;
  /** Which plan's row this cell sits in. The grid draws one row per plan, so an edit without it is
   *  ambiguous — and an ambiguous price edit is how a rate lands on a plan nobody was looking at. */
  ratePlanId?: string;
  /** Nobody set this night's price — it is the plan's default, or its parent's. Rendered lighter with
   *  this as the hover, so a default and a decision do not look the same. */
  note?: string;
}) {
  const [pending, start] = useTransition();
  const locale = useLocale();
  const s = translate(inventoryDict, locale);
  const money = moneyIn(locale);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit(raw: string) {
    const clean = raw.replace(/[^0-9.]/g, "");
    start(async () => {
      if (clean !== "") await saveCalendarRate({ roomTypeId, date, value: clean, ...(ratePlanId ? { ratePlanId } : {}) });
      setEditing(false);
    });
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
        className="tnum w-full min-w-[44px] rounded border border-brand-600 bg-white px-1 py-0.5 text-center text-[12px] font-semibold text-ink-900 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      className={`tnum w-full rounded px-1 py-0.5 text-center text-[12px] transition-colors hover:bg-brand-50 ${note ? "font-normal text-ink-400" : "font-semibold text-ink-700"} ${pending ? "opacity-50" : ""}`}
      title={note ?? s.clickToChange}
    >
      {value === "—" ? "—" : money(Number(value) * 100)}
    </button>
  );
}
