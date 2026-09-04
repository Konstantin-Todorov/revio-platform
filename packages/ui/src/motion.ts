/**
 * Motion tokens.
 *
 * ## Why this file exists
 *
 * A count across the five apps found **433 transitions that animate colour and nothing else**, three
 * that animate elevation, and fourteen that animate transform. That ratio is the whole of the
 * "it doesn't feel as polished as theirs" problem, and it is not a framework difference: Tailwind's
 * default timing function is already `cubic-bezier(.4, 0, .2, 1)`, the same curve Material calls
 * *standard*. We had the right curve applied to the wrong property.
 *
 * The values below match the published Material/MUI defaults, which are MIT-licensed and documented
 * publicly. They are four numbers and four curves — adopting them copies no one's code, and it means
 * our timing agrees with the timing a hotelier already has muscle memory for from every other tool
 * on their desk.
 *
 * ## The two rules
 *
 * 1. **Never transition colour alone.** If a control responds to the pointer, at least one of
 *    elevation, transform or border responds with it.
 * 2. **Every interactive element gets a `:focus-visible` ring.** Before this there were *two* on the
 *    entire platform against 1,203 interactive elements — a keyboard user could not see where they
 *    were anywhere in the product. That is an accessibility defect first and a polish problem second.
 *
 * ## Exit is always faster than enter
 *
 * `exit` (195ms) is deliberately shorter than `enter` (225ms). A dialog that takes as long to leave
 * as it took to arrive reads as lag, because by then the user has already decided and is waiting on
 * us. Arriving is information; leaving is just cleanup.
 */
export const duration = {
  /** Colour, and small state flips that should feel instant. */
  fast: "150ms",
  /** Elevation, transform, border width — anything with physical weight. */
  base: "200ms",
  /** Menus, popovers, drawers, toasts arriving. */
  enter: "225ms",
  /** The same things leaving. Always quicker than arriving. */
  exit: "195ms",
} as const;

export const easing = {
  /** The default for a state change on something already on screen. */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Entering the screen — decelerates into place. */
  out: "cubic-bezier(0.0, 0, 0.2, 1)",
  /** Leaving the screen — accelerates away. */
  in: "cubic-bezier(0.4, 0, 1, 1)",
  /** Things that may come back: a drawer, a collapsing row. */
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
} as const;

/**
 * The focus ring, as one string.
 *
 * A `box-shadow` rather than an `outline` so it follows the border radius on every browser, and
 * `:focus-visible` rather than `:focus` so it appears for keyboard navigation without firing on
 * every mouse click. Tailwind: `focus-visible:outline-none focus-visible:shadow-focus`.
 */
export const focusRing = "0 0 0 3px rgba(37, 99, 201, 0.32)";

/** Danger-toned variant, so a destructive control's ring does not read as the primary action. */
export const focusRingDanger = "0 0 0 3px rgba(181, 53, 40, 0.32)";
