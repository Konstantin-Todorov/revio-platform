"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { keepThisTrial } from "@/lib/actions-self-trial";

/**
 * The one thing to press on the trial-ended screen.
 *
 * It records the ask against the trial itself (`ProductTrial.keepRequestedAt`), which the operator
 * console already surfaces as "they asked to keep it" — the strongest buying signal we get. It does
 * NOT switch anything back on: converting a trial is a deliberate decision somebody at Revio makes,
 * and a button that silently granted a licence would be a pricing decision made by a click.
 */
export function KeepItButton({ product }: { product: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await keepThisTrial(); })}
      className="flex h-10 items-center gap-2 rounded-md bg-brand-800 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      data-product={product}
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "Letting them know…" : "I want to keep it"}
    </button>
  );
}
