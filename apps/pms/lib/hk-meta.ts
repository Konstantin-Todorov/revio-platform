// Housekeeping status metadata — a PLAIN module (no "server-only"/"use client") so both server
// screens and client controls can import it. Statuses per docs/PMS-REFERENCE.md.
import type { Tone } from "@/components/ui/primitives";

export const HK_STATUSES = ["clean", "dirty", "inspected", "out_of_order"] as const;
export type HkStatus = (typeof HK_STATUSES)[number];

export const HK_LABEL: Record<HkStatus, string> = {
  clean: "Clean",
  dirty: "Dirty",
  inspected: "Inspected",
  out_of_order: "Out of order",
};

/** Maps to the shared StatusPill tones (info renders as the accent/purple pill). */
export const HK_TONE: Record<HkStatus, Tone> = {
  clean: "success",
  dirty: "warning",
  inspected: "info",
  out_of_order: "danger",
};

/** Tile background + border tint for the housekeeping board. */
export const HK_TILE: Record<HkStatus, string> = {
  clean: "border-success-500/50 bg-success-50",
  dirty: "border-warning-500/60 bg-warning-50",
  inspected: "border-accent-500/50 bg-accent-50",
  out_of_order: "border-danger-500/60 bg-danger-50",
};
