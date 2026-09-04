import type { Config } from "tailwindcss";

/** Atlas-derived theme. Colors mirror @revio/ui tokens (shared across all Revio apps). */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-hanken)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: { 900: "#0e1f3a", 800: "#15366a", 700: "#1d4ea0", 600: "#2563c9", 50: "#e7eefb" },
        ink: { 900: "#1c2733", 700: "#3f4753", 500: "#5b6675", 400: "#7d8aa3", 300: "#9aa3b1" },
        surface: { DEFAULT: "#ffffff", page: "#f7f8fa", muted: "#f1f3f6", sunken: "#e7eaef", border: "#dde4ee" },
        success: { 600: "#0f7a52", 500: "#1f9d6b", 50: "#e3f4ec" },
        warning: { 600: "#e0822b", 500: "#e0a23b", 50: "#fbf1e0" },
        danger: { 600: "#b53528", 500: "#d6493b", 50: "#fbe9e7" },
        info: { 500: "#0d9aa8" },
        /*
         * RevioPMS's `accent` is the PLATFORM BLUE — deliberately not its emerald mark.
         *
         * This app is the only one that made `accent` its primary action colour (a hundred-odd
         * buttons, links and active states, where CM/CRS/Operator use `brand-800`), and it inherited
         * the old platform purple, which appears nowhere in the brand the founder actually drew.
         *
         * Emerald was the obvious replacement and it is wrong here, for a reason only visible on a
         * real screen: **`success` is already green.** The housekeeping board puts a solid
         * `bg-success-600` "Finish" button in the same row as `bg-accent-600` controls, and
         * emerald-700 (#047857) against success-600 (#0f7a52) is the same colour to anyone
         * glancing at it — two greens meaning "done" and "primary action" side by side. The
         * notification dots do the same thing with `info` and `success`.
         *
         * So the mark stays emerald and the *chrome* carries the identity (`product-*` below:
         * sidebar mark, active rail, wordmark, avatar, favicon); the action colour matches the rest
         * of the platform, which is also what a user moving between four apps on one login expects.
         * Mirrors `brand` 800/700/50 exactly — kept as its own name so a hundred class names did not
         * have to be swept to say the same thing.
         */
        accent: { 600: "#15366a", 500: "#1d4ea0", 50: "#e7eefb" },

        /*
         * The one scale that differs between the four apps — RevioPMS.
         *
         * The emerald of the RevioPMS tile. The floor of the hotel.
         *
         * Three roles because one hex cannot do all three jobs: `mark` is the accent on the navy
         * chrome and belongs only there; `ink` is the same hue darkened until it reads as text on
         * white (measured ≥ 4.5:1); `wash` is the tint behind a selected row. Mirrors
         * `productAccents` in @revio/ui — and it is the tile colour of this app's own logo, so the
         * mark and the rail beside the active nav item match by construction.
         *
         * Kept separate from `warning`/`accent`, which stayed semantic: an amber rail meant
         * "identity" in one place and "something needs attention" in another.
         */
        product: { mark: "#34d399", ink: "#047857", wash: "#ecfdf5" },
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px", xl: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,31,58,0.04), 0 1px 3px rgba(16,31,58,0.06)",
        pop: "0 8px 24px rgba(16,31,58,0.12)",
        /* Mirrors `shadow` in @revio/ui tokens. A `float` card drops its border — the two
           do not layer, or the outline wins and the blur is wasted paint. */
        float: "0 1px 2px 0 rgba(16,31,58,0.04), 0 8px 24px -6px rgba(16,31,58,0.10)",
        raised: "0 2px 6px 0 rgba(16,31,58,0.05), 0 16px 40px -8px rgba(16,31,58,0.14)",
        overlay: "0 12px 48px -8px rgba(16,31,58,0.20), 0 4px 12px -2px rgba(16,31,58,0.08)",
        /* The focus ring, as a shadow so it follows border-radius everywhere.
           Pair with `focus-visible:outline-none`. Mirrors `focusRing` in @revio/ui/motion. */
        focus: "0 0 0 3px rgba(37,99,201,0.32)",
        "focus-danger": "0 0 0 3px rgba(181,53,40,0.32)",
      },
      /* Motion — mirrors @revio/ui/motion. Two rules: never transition colour alone, and
         every interactive element gets a focus ring. Exit is faster than enter on purpose. */
      /*
       * `transition-colors` is extended, not merely themed.
       *
       * House motion rule 1 is "never transition colour alone": if a control responds to the
       * pointer, at least one of elevation or transform responds with it. 433 elements already say
       * `transition-colors` and would each need editing to obey that — a diff nobody could review.
       * Adding box-shadow and transform to what the utility transitions reaches all of them at once.
       *
       * The name now under-describes what it does, which is the trade: it only ever matters where a
       * state change ALSO moves shadow or transform, so it can never animate something that was not
       * already meant to move. `transition-none` still opts out, per element.
       */
      transitionProperty: {
        colors:
          "color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow, transform",
      },
      transitionDuration: { fast: "150ms", base: "200ms", enter: "225ms", exit: "195ms" },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        out: "cubic-bezier(0.0, 0, 0.2, 1)",
        in: "cubic-bezier(0.4, 0, 1, 1)",
        sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
