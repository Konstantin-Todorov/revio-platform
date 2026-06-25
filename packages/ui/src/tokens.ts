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

export const radius = { sm: "6px", md: "10px", lg: "14px" } as const;

export const space = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
} as const;
