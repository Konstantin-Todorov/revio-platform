"use client";

import { useState, useTransition } from "react";
import { setEntitlement } from "@/lib/actions";

const LABELS = { channelManager: "CM", reservation: "CRS", pms: "PMS" } as const;
const ACTIVE = {
  channelManager: "bg-brand-700 text-white",
  reservation: "bg-accent-600 text-white",
  pms: "bg-success-600 text-white",
} as const;

export function EntitlementToggle({
  tenantId, product, enabled,
}: {
  tenantId: string;
  product: "channelManager" | "reservation" | "pms";
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      await setEntitlement(tenantId, product, next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={`${on ? "Disable" : "Enable"} ${LABELS[product]}`}
      className={`rounded px-2 py-1 text-[11px] font-bold transition-colors ${on ? ACTIVE[product] : "bg-surface-sunken text-ink-400 hover:bg-surface-border"} ${pending ? "opacity-60" : ""}`}
    >
      {LABELS[product]}
    </button>
  );
}
