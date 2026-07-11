// Housekeeping status metadata — a PLAIN module (no "server-only"/"use client") so both server
// screens and client controls can import it. Statuses per docs/PMS-REFERENCE.md.
import type { Tone } from "@/components/ui/primitives";

// Ordered dirty → in-progress → clean → inspected → OOO (the cleaning lifecycle). `in_progress`
// (spec §3.4) makes a mid-clean room visible to reception + the supervisor; it is NOT sellable.
export const HK_STATUSES = ["dirty", "in_progress", "clean", "inspected", "out_of_order"] as const;
export type HkStatus = (typeof HK_STATUSES)[number];

export const HK_LABEL: Record<HkStatus, string> = {
  clean: "Clean",
  dirty: "Dirty",
  in_progress: "Cleaning",
  inspected: "Inspected",
  out_of_order: "Out of order",
};

/** Maps to the shared StatusPill tones (info renders as the accent/purple pill). */
export const HK_TONE: Record<HkStatus, Tone> = {
  clean: "success",
  dirty: "warning",
  in_progress: "info",
  inspected: "info",
  out_of_order: "danger",
};

/** Tile background + border tint for the housekeeping board. */
export const HK_TILE: Record<HkStatus, string> = {
  clean: "border-success-500/50 bg-success-50",
  dirty: "border-warning-500/60 bg-warning-50",
  in_progress: "border-brand-500/50 bg-brand-50",
  inspected: "border-accent-500/50 bg-accent-50",
  out_of_order: "border-danger-500/60 bg-danger-50",
};

/** Sellable (serviceable) statuses depend on the inspection gate (spec §3.4). Gate ON ⇒ nothing is
 * sellable until a supervisor inspects, so `clean` means "cleaned, pending inspection". Gate OFF ⇒
 * cleaned counts as sellable. `in_progress`/`dirty`/`out_of_order` are never sellable. */
export function sellableStatuses(inspectionGate: boolean): HkStatus[] {
  return inspectionGate ? ["inspected"] : ["clean", "inspected"];
}
