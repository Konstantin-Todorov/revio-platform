"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, Layers } from "lucide-react";
import { setActiveProperty, setGroupScope } from "@/lib/actions-session";

type Item = { id: string; name: string; tenantName: string };

export function WorkspaceSwitcher({
  properties, activeId, activeName, scope, canGroup,
}: {
  properties: Item[];
  activeId: string;
  activeName: string;
  scope: "property" | "group";
  canGroup: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isGroup = scope === "group";

  // Group by tenant so it's clear which hotel group each property belongs to.
  const byTenant = properties.reduce<Record<string, Item[]>>((acc, p) => {
    (acc[p.tenantName] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-900 transition-colors hover:bg-surface-muted"
      >
        {isGroup ? <Layers className="h-4 w-4 text-brand-600" /> : <Building2 className="h-4 w-4 text-brand-600" />}
        {activeName}
        <ChevronDown className="h-4 w-4 text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-lg border border-surface-border bg-white shadow-pop">
          <div className="border-b border-surface-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Your properties
          </div>
          {/* Portfolio scope — Dashboard + Analytics aggregate across every property (spec §4.1). */}
          {canGroup && (
            <button
              onClick={() => { setGroupScope(); setOpen(false); }}
              className={`flex w-full items-center gap-2 border-b border-surface-border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-surface-muted ${isGroup ? "font-semibold text-brand-700" : "text-ink-700"}`}
            >
              <Layers className="h-4 w-4 text-brand-600" />
              <span className="flex-1">All properties <span className="text-[11px] font-normal text-ink-400">· portfolio totals</span></span>
              {isGroup && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          )}
          <div className="max-h-80 overflow-y-auto py-1">
            {Object.entries(byTenant).map(([tenant, items]) => (
              <div key={tenant}>
                <div className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-300">{tenant}</div>
                {items.map((p) => {
                  const activeProp = !isGroup && p.id === activeId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProperty(p.id); setOpen(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-muted ${activeProp ? "font-semibold text-brand-700" : "text-ink-700"}`}
                    >
                      <Building2 className="h-3.5 w-3.5 text-ink-300" />
                      <span className="flex-1">{p.name}</span>
                      {activeProp && <Check className="h-4 w-4 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
