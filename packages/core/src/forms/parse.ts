/**
 * Reading numbers off a form, without silently inventing zeros (Y1).
 *
 * ## The bug this replaces
 *
 * Every app had:
 *
 * ```ts
 * export function int(fd: FormData, key: string, fallback = 0): number {
 *   const n = Number(fd.get(key));
 *   return Number.isFinite(n) ? Math.trunc(n) : fallback;
 * }
 * ```
 *
 * which looks careful and is not, because **`Number("")` is `0` and `Number(null)` is `0`.** So:
 *
 * - A user types letters into `<input type="number">`. The browser refuses to expose a
 *   non-numeric value and submits **`""`**. That became **0**.
 * - A field is missing from the payload entirely. `fd.get()` returns `null`. That became **0**.
 * - The `fallback` argument only ever fired for a non-numeric *string* — which a number input can
 *   never produce. It was nearly dead code, sitting in 21 call sites looking like protection.
 *
 * The result was not an error message. It was a successful save of the wrong number: rooms-to-sell
 * silently 0 (the property closed out on every channel), VAT silently 0% instead of 20%, a sync
 * horizon of 1 day instead of 365.
 *
 * ## What this does instead
 *
 * Parsing answers three different questions and the caller usually needs to tell them apart:
 *
 * - **absent** — the field was not in the payload at all. Usually means "leave it alone".
 * - **empty** — the field was there and blank. Usually means "use the default", and is ALSO what a
 *   browser sends when someone typed something a number input could not accept.
 * - **invalid** — there was text and it is not a number. Worth telling the user about.
 *
 * `parseNumberField` returns which one it was. `intOr`/`decimalOr` are the convenience wrappers for
 * the common case, and — unlike the old `int` — they return the fallback for **all three**
 * non-values, which is what every existing call site already believed was happening.
 *
 * Pure and framework-free: it takes the raw value, not a FormData, so it is testable and so the
 * booking engine and a future API can use the same rules as a form post.
 */

export type NumberFieldResult =
  | { kind: "value"; value: number }
  /** Key was not present in the payload. */
  | { kind: "absent" }
  /** Present but blank or whitespace — including what a number input sends for unparseable typing. */
  | { kind: "empty" }
  /** Present, non-blank, and not a finite number. */
  | { kind: "invalid"; raw: string };

export interface NumberFieldOptions {
  /** Reject anything with a fractional part. */
  integer?: boolean;
  min?: number;
  max?: number;
}

/**
 * Parse one raw form value.
 *
 * `min`/`max` violations come back as `invalid` rather than being silently clamped. Clamping is what
 * turned "someone typed 5000%" into "VAT is now 100%" — a number the hotel never chose and would
 * not notice. If a caller genuinely wants clamping it can do it, visibly, at the call site.
 */
export function parseNumberField(
  raw: FormDataEntryValue | string | null | undefined,
  opts: NumberFieldOptions = {},
): NumberFieldResult {
  if (raw === null || raw === undefined) return { kind: "absent" };
  // A File in a numeric field is somebody sending us something strange; treat it as invalid rather
  // than stringifying it into "[object File]".
  if (typeof raw !== "string") return { kind: "invalid", raw: String(raw) };

  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "empty" };

  // `Number` accepts things a form field never legitimately produces and that a hotelier never
  // means: "0x10", "1e3", "Infinity". Requiring a plain decimal keeps a typo an error instead of a
  // surprising value.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) return { kind: "invalid", raw: trimmed };

  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { kind: "invalid", raw: trimmed };
  if (opts.integer && !Number.isInteger(n)) return { kind: "invalid", raw: trimmed };
  if (opts.min !== undefined && n < opts.min) return { kind: "invalid", raw: trimmed };
  if (opts.max !== undefined && n > opts.max) return { kind: "invalid", raw: trimmed };

  return { kind: "value", value: n };
}

/**
 * An integer, or the fallback when the field is absent, blank or unparseable.
 *
 * This is the drop-in for the old `int(fd, key, fallback)` — same shape, except the fallback now
 * actually happens. A caller that needs to TELL THE USER the value was rejected should use
 * `parseNumberField` and branch on `invalid`.
 */
export function intOr(raw: FormDataEntryValue | string | null | undefined, fallback: number): number {
  const r = parseNumberField(raw, { integer: false });
  return r.kind === "value" ? Math.trunc(r.value) : fallback;
}

/** A decimal, or the fallback. For prices and rates the caller converts to minor units itself. */
export function decimalOr(raw: FormDataEntryValue | string | null | undefined, fallback: number): number {
  const r = parseNumberField(raw);
  return r.kind === "value" ? r.value : fallback;
}

/**
 * Money, as integer minor units, from a major-unit form field ("129.50" → 12950).
 *
 * ⚠️ Converted from the DECIMAL STRING, never by multiplying a float by 100.
 *
 * The obvious implementation is `Math.round(Number(raw) * 100)`, and it is wrong in a way that only
 * shows up on specific values: `1.15 * 100` is `114.99999999999999` and `1.005 * 100` is
 * `100.49999999999999`. Rounding rescues the first and silently loses a cent on the second. This
 * platform's rule is that money is integer minor units and never a float — so the conversion reads
 * the digits either side of the decimal point and never lets the value become a float at all.
 *
 * A third decimal place rounds half-up on the digit, which is what a person means by "round to the
 * nearest cent" and what an invoice has to be able to justify.
 */
export function minorUnitsOr(
  raw: FormDataEntryValue | string | null | undefined,
  fallback: number,
): number {
  const r = parseNumberField(raw, { min: 0 });
  if (r.kind !== "value") return fallback;

  const text = String(raw).trim();
  const [whole = "0", frac = ""] = text.replace(/^\+/, "").split(".");
  const cents = (frac + "00").slice(0, 2);
  const roundUp = frac.length > 2 && Number(frac[2]) >= 5;
  const magnitude = Number(whole || "0") * 100 + Number(cents) + (roundUp ? 1 : 0);
  return magnitude;
}

/**
 * Human wording for a rejected field, for showing next to the input.
 *
 * Names the field and what was wrong with it. "Invalid input" tells somebody nothing about which of
 * the eleven boxes on a bulk-update form they need to look at.
 */
export function numberFieldError(label: string, result: NumberFieldResult, opts: NumberFieldOptions = {}): string | null {
  if (result.kind !== "invalid") return null;
  if (opts.min !== undefined && opts.max !== undefined) {
    return `${label} must be a number between ${opts.min} and ${opts.max}.`;
  }
  if (opts.min !== undefined) return `${label} must be a number of at least ${opts.min}.`;
  if (opts.max !== undefined) return `${label} must be a number no greater than ${opts.max}.`;
  if (opts.integer) return `${label} must be a whole number.`;
  return `${label} must be a number.`;
}
