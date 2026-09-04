/**
 * Curve helpers shared by the product's charts.
 *
 * Our charts were polylines: straight segments between daily readings, which on a 60-day occupancy
 * range draws a sawtooth and makes an ordinary week look volatile. Smoothing is not decoration here
 * — it is the difference between a reader seeing a trend and a reader seeing noise.
 *
 * ## Why Catmull-Rom and not a quadratic smoothing
 *
 * The usual quick smoothing (midpoint quadratics) **overshoots**: the curve bulges past the highest
 * and lowest readings. On a percentage axis that draws occupancy above 100%, and on revenue it draws
 * a bar-height the hotel did not earn. Catmull-Rom passes exactly through every supplied point and
 * only interpolates between them, so the drawn line never claims a value the data does not contain.
 * For a chart a hotelier prices rooms from, that property is mandatory rather than nice.
 */

export type Pt = readonly [number, number];

/**
 * A cubic bezier path through every point, in order.
 *
 * `tension` divides the control-point reach: 6 is the standard Catmull-Rom, and larger numbers pull
 * the curve tighter toward straight segments. Endpoints duplicate their neighbour so the first and
 * last spans curve like the rest instead of flattening.
 */
export function smoothPath(points: readonly Pt[], tension = 6): string {
  const first = points[0];
  if (!first) return "";

  const n = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "0");
  let d = `M ${n(first[0])},${n(first[1])}`;
  if (points.length === 1) return d;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;
    // Endpoints duplicate their neighbour so the first and last spans curve like the rest.
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;

    const c1x = p1[0] + (p2[0] - p0[0]) / tension;
    const c1y = p1[1] + (p2[1] - p0[1]) / tension;
    const c2x = p2[0] - (p3[0] - p1[0]) / tension;
    const c2y = p2[1] - (p3[1] - p1[1]) / tension;

    d += ` C ${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(p2[0])},${n(p2[1])}`;
  }
  return d;
}

/**
 * The same curve, closed along a baseline so it can carry a gradient fill.
 *
 * Kept beside `smoothPath` rather than derived at each call site: the fill and the stroke must use
 * an identical curve, and two call sites recomputing it separately is how they drift apart by a
 * tension argument and paint a fill that no longer sits under its own line.
 */
export function smoothAreaPath(points: readonly Pt[], baselineY: number, tension = 6): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return "";
  const line = smoothPath(points, tension);
  return `${line} L ${last[0].toFixed(2)},${baselineY.toFixed(2)} L ${first[0].toFixed(2)},${baselineY.toFixed(2)} Z`;
}

/**
 * Index of the point nearest a pointer position, for a crosshair that snaps to real readings.
 *
 * Snapping rather than interpolating is the honest choice: between two days there is no value, so a
 * tooltip that reads "73.4%" halfway between Tuesday and Wednesday is inventing a number.
 */
export function nearestIndex(
  pointerX: number,
  count: number,
  plotLeft: number,
  plotWidth: number,
): number {
  if (count <= 1) return 0;
  const t = (pointerX - plotLeft) / plotWidth;
  return Math.max(0, Math.min(count - 1, Math.round(t * (count - 1))));
}
