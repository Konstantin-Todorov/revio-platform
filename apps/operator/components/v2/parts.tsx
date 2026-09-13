import type { ReactNode } from "react";

/**
 * The handful of shapes every v2 page is drawn from.
 *
 * Kept deliberately small: four things, not a component library. A candidate design earns more
 * abstraction by surviving, and building a framework for a look nobody has agreed to is how a
 * redesign turns into a rewrite.
 */

export type Sev = "act" | "soon" | "note";
export const SEV: Record<Sev, string> = { act: "var(--neg)", soon: "var(--warn)", note: "var(--ink-4)" };

/** Initials from a hotel name, for the neutral avatar. Never a colour block — see the v2 notes. */
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** Points → a polyline, scaled to the data. A fixed ceiling is how a chart draws outside itself. */
export function poly(values: number[], w: number, h: number) {
  if (values.length < 2) return "";
  const max = Math.max(1, ...values.map((v) => Math.max(0, v)));
  return values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (Math.max(0, v) / max) * h}`).join(" ");
}

export function PageTitle({ title, right, lede }: { title: string; right?: ReactNode; lede?: string }) {
  return (
    <>
      <div className="ptitle">
        <h1>{title}</h1>
        <span className="sp" />
        {right}
      </div>
      {lede && <p className="lede">{lede}</p>}
    </>
  );
}

export function Panel({ title, badge, action, children }: {
  title: string; badge?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="card in">
      <div className="chead">
        <h2>{title}</h2>
        {badge}
        <span className="sp" style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A metric tile whose card is FILLED — a faint chart occupies the lower half and the numbers sit
 * over it. That is Mercury's answer to the hollow white card, and it is the single technique that
 * stops a KPI row looking like an empty grid.
 */
export function Tile({ label, value, note, tone = "brand", spark = [] }: {
  label: string; value: string; note?: string; tone?: string; spark?: number[];
}) {
  return (
    <section className="card tile">
      {spark.length > 1 && (
        <svg className="sparkbg" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={poly(spark, 200, 34)} fill="none" stroke={`var(--${tone})`} strokeWidth="1.6" opacity=".8" />
        </svg>
      )}
      <div className="lbl">{label}</div>
      <div className="row"><span className="v tn">{value}</span></div>
      {note && <div className="cx">{note}</div>}
    </section>
  );
}

/** A zero state written as a completed state — never a blank rectangle. */
export function AllClear({ children }: { children: ReactNode }) {
  return (
    <div className="allclear">
      <span className="tick">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
      </span>
      {children}
    </div>
  );
}

export const money = (minor: number) =>
  (minor / 100).toLocaleString("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const moneyExact = (minor: number) =>
  (minor / 100).toLocaleString("en-GB", { style: "currency", currency: "EUR" });
