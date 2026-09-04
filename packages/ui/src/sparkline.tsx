/**
 * A bare trend line for a stat card — no axes, no labels, no library.
 *
 * Deliberately not a chart: it carries shape, not values. The number beside it is the fact; this
 * only says "rising", "falling" or "steady" at a glance, which is why it has no scale and no
 * tooltip. Anything that needs to be read precisely belongs in a real chart.
 *
 * Pure SVG on purpose — a stat row renders four to eight of these, and pulling a charting runtime
 * into the page for eight decorative polylines is the kind of weight that shows up on a hotel's
 * office laptop.
 */
export function Sparkline({
  points,
  stroke,
  className = "",
  width = 96,
  height = 32,
}: {
  /** Raw series, oldest first. Fewer than two points renders nothing. */
  points: number[];
  /** Any CSS colour — usually the tone's own 600. */
  stroke: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series has zero range; without this guard every point divides by zero and disappears.
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => (width * i) / (points.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);

  const line = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // The fill closes the path along the bottom edge so the gradient has something to fade into.
  const area = `${line} ${width},${height} 0,${height}`;
  const gid = `sl-${stroke.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`shrink-0 ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
