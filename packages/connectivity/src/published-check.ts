/**
 * What the channel is ACTUALLY publishing, against what we think we sent it.
 *
 * ## Why this exists and the Sync Center does not answer it
 *
 * Every other signal in this system reports on the ATTEMPT. "Pushed 2,000 updates · success" says
 * a request was accepted; it cannot say the price landed on the right room, because from our side
 * a mis-mapped push and a correct one look identical — both succeed.
 *
 * That is not theoretical twice over. BUG-014: 411 consecutive "Pulled 0 revisions · success"
 * events on a hotel whose key had been revoked. BUG-019: a €666 price set on the 1-Bedroom
 * published against the 2-Bedroom for days, with the Sync Center green throughout.
 *
 * **This reads the destination.** One API call per room, and a mis-mapping announces itself instead
 * of hiding — which is the only kind of confirmation worth having when the failure mode is a push
 * that succeeds at doing the wrong thing.
 */

export interface PublishedRate {
  /** The channel's own rate-plan id — what we mapped TO. */
  externalRateId: string;
  date: string;
  /** Minor units, as the channel holds it. Null when the channel published nothing for that date. */
  priceMinor: number | null;
}

export interface ExpectedRate {
  externalRateId: string;
  date: string;
  priceMinor: number | null;
  /** For the message: which of OUR rooms and plans this came from. */
  roomTypeName: string;
  ratePlanName: string;
}

export type VerdictKind = "match" | "mismatch" | "missing" | "unexpected";

export interface PublishedComparison {
  kind: VerdictKind;
  externalRateId: string;
  date: string;
  ours: number | null;
  theirs: number | null;
  roomTypeName?: string;
  ratePlanName?: string;
}

/**
 * Compare what we hold with what the channel holds.
 *
 * ⚠️ **`missing` and `mismatch` are different findings and are never merged.** A price the channel
 * never received is a mapping or a push that did not happen; a price that differs is a push that
 * landed somewhere unexpected or was overwritten. They have different causes and different fixes,
 * and one count covering both would send somebody to the wrong screen.
 *
 * ⚠️ **`unexpected` is reported too** — a rate the channel is publishing that we did not send. That
 * is the shape a mis-mapping leaves behind on the room it wrongly wrote to, and it is the finding
 * that names the €666 fault from the other end.
 */
export function comparePublished(
  expected: readonly ExpectedRate[],
  published: readonly PublishedRate[],
): PublishedComparison[] {
  const key = (r: { externalRateId: string; date: string }) => `${r.externalRateId}|${r.date}`;
  const theirs = new Map(published.map((p) => [key(p), p]));
  const seen = new Set<string>();
  const out: PublishedComparison[] = [];

  for (const e of expected) {
    const k = key(e);
    seen.add(k);
    const p = theirs.get(k);

    if (!p || p.priceMinor == null) {
      // Nothing to compare against. Only a finding when we believed we had sent something.
      if (e.priceMinor != null) {
        out.push({
          kind: "missing", externalRateId: e.externalRateId, date: e.date,
          ours: e.priceMinor, theirs: null,
          roomTypeName: e.roomTypeName, ratePlanName: e.ratePlanName,
        });
      }
      continue;
    }

    if (e.priceMinor == null) continue;

    out.push({
      kind: p.priceMinor === e.priceMinor ? "match" : "mismatch",
      externalRateId: e.externalRateId, date: e.date,
      ours: e.priceMinor, theirs: p.priceMinor,
      roomTypeName: e.roomTypeName, ratePlanName: e.ratePlanName,
    });
  }

  for (const p of published) {
    if (seen.has(key(p)) || p.priceMinor == null) continue;
    out.push({
      kind: "unexpected", externalRateId: p.externalRateId, date: p.date,
      ours: null, theirs: p.priceMinor,
    });
  }

  return out;
}

export interface PublishedSummary {
  checked: number;
  matched: number;
  mismatched: number;
  missing: number;
  unexpected: number;
  /** The first few findings, for a line somebody can act on without opening anything. */
  examples: PublishedComparison[];
  headline: string;
}

export function summarisePublished(rows: readonly PublishedComparison[]): PublishedSummary {
  const count = (k: VerdictKind) => rows.filter((r) => r.kind === k).length;
  const matched = count("match");
  const mismatched = count("mismatch");
  const missing = count("missing");
  const unexpected = count("unexpected");
  const problems = rows.filter((r) => r.kind !== "match");

  const headline =
    rows.length === 0
      ? "Nothing to check — no prices are mapped for these dates yet."
      : problems.length === 0
        ? `The channel is publishing exactly what we sent, on all ${matched} checked.`
        : [
            mismatched > 0 ? `${mismatched} published at a different price` : null,
            missing > 0 ? `${missing} never arrived` : null,
            unexpected > 0 ? `${unexpected} published that we did not send` : null,
          ].filter(Boolean).join(" · ");

  return {
    checked: rows.length, matched, mismatched, missing, unexpected,
    examples: problems.slice(0, 5),
    headline,
  };
}
