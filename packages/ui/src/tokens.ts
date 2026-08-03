/** Revio design tokens for TS / Tailwind config. Mirrors tokens.css. Derived from the Atlas direction. */

export const colors = {
  brand: {
    900: "#0e1f3a",
    800: "#15366a",
    700: "#1d4ea0",
    600: "#2563c9",
    "050": "#e7eefb",
  },
  ink: {
    900: "#1c2733",
    700: "#3f4753",
    500: "#5b6675",
    400: "#7d8aa3",
    300: "#9aa3b1",
  },
  surface: {
    DEFAULT: "#ffffff",
    muted: "#f1f3f6",
    sunken: "#e7eaef",
    border: "#dde4ee",
  },
  success: { 600: "#0f7a52", 500: "#1f9d6b", "050": "#e3f4ec" },
  warning: { 600: "#e0822b", 500: "#e0a23b", "050": "#fbf1e0" },
  danger: { 600: "#b53528", 500: "#d6493b", "050": "#fbe9e7" },
  info: { 500: "#0d9aa8" },
  accent: { 600: "#5b3fb0", 500: "#7c5cdb", "050": "#efe9fb" },
} as const;

/**
 * Per-product accent — the one colour that differs between the four staff apps.
 *
 * Taken from the brand marks the founder supplied (`design/brand/`), not invented: the tile colour
 * of each product's logo IS its accent, so the mark in the sidebar and the rail beside the active
 * nav item are the same colour by construction rather than by anyone remembering to match them.
 *
 * Three roles, because one hex cannot do all three jobs. `mark` is the accent on the navy chrome and
 * is only ever used there; `ink` is the same hue darkened until it actually reads as text on white
 * (cyan-400 as a headline is unreadable — every `ink` here is measured ≥ 4.5:1); `wash` is the tint
 * behind a selected row.
 *
 * **Operator has no accent, deliberately.** It is the platform, not a product — so its mark is the
 * plain white/navy Revio identity and the slot where a product colour would go is left empty. If a
 * fifth product ever appears, it gets a colour; the console never does.
 *
 * RevioDirect is absent for a different reason: the booking page wears the *hotel's* brand colour,
 * computed per property in `apps/booking/lib/brand.ts`. Painting Revio's identity on a guest-facing
 * page would contradict the entire product.
 */
export const productAccents = {
  channelManager: { name: "RevioLink", mark: "#24d3ee", ink: "#0e7490", wash: "#ecfeff" },
  reservation: { name: "RevioCRS", mark: "#818cf8", ink: "#4f46e5", wash: "#eef2ff" },
  pms: { name: "RevioPMS", mark: "#34d399", ink: "#047857", wash: "#ecfdf5" },
  operator: { name: "Revio Operator", mark: "#ffffff", ink: "#0e203c", wash: "#eef2f7" },
} as const;

/** The navy the marks are drawn in — darker than `brand.900`, and fixed by the artwork. */
export const brandNavy = "#0e203c";

export const fontFamily = {
  sans: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

export const radius = { sm: "6px", md: "10px", lg: "14px" } as const;

export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
} as const;
