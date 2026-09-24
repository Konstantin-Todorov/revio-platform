import type { CommonStrings } from "./common";

/**
 * A resolved date range in the reader's language: the preset's name, or the two dates of a custom
 * one. `resolveRange` keeps its English `label` for any caller that does not word it itself.
 */
export function rangeLabel(
  range: { preset: string; start: string; endExcl: string; label: string },
  c: CommonStrings,
  day: (iso: string) => string,
): string {
  if (range.preset === "custom") {
    const last = new Date(`${range.endExcl}T00:00:00Z`);
    last.setUTCDate(last.getUTCDate() - 1);
    return `${day(range.start)} → ${day(last.toISOString().slice(0, 10))}`;
  }
  return c.ranges[range.preset as keyof CommonStrings["ranges"]] ?? range.label;
}
