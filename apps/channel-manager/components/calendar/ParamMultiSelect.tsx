"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";

/**
 * A dropdown of checkboxes bound to ONE CSV search param (e.g. ?rt=DDR,STR or ?rows=sold,minlos).
 * Empty selection removes the param (= "default/all"). Server components read it back.
 */
export function ParamMultiSelect({
  label, param, options, selected, emptyLabel,
}: {
  label: string;
  param: string;
  options: { value: string; label: string }[];
  selected: string[];
  emptyLabel: string; // what an empty selection means, e.g. "All rooms" / "Default rows"
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setPicked(new Set(selected)), [selected]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function apply() {
    const params = new URLSearchParams(search.toString());
    if (picked.size === 0 || picked.size === options.length) params.delete(param);
    else params.set(param, [...picked].join(","));
    router.push(`?${params.toString()}`);
    setOpen(false);
  }

  const summary = selected.length === 0 || selected.length === options.length ? emptyLabel : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted"
      >
        {label}: <span className="text-brand-700">{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-60 overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((o) => {
              const on = picked.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    const next = new Set(picked);
                    if (on) next.delete(o.value); else next.add(o.value);
                    setPicked(next);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-surface-muted"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-surface-border bg-white"}`}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 border-t border-surface-border px-3 py-2">
            <button type="button" onClick={() => setPicked(new Set())} className="rounded px-2 py-1 text-[12px] font-semibold text-ink-500 hover:bg-surface-muted">Clear</button>
            <button type="button" onClick={apply} className="rounded-md bg-brand-800 px-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
