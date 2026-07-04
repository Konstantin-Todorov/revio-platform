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
        surface: { DEFAULT: "#ffffff", muted: "#f1f3f6", sunken: "#e7eaef", border: "#dde4ee" },
        success: { 600: "#0f7a52", 500: "#1f9d6b", 50: "#e3f4ec" },
        warning: { 600: "#e0822b", 500: "#e0a23b", 50: "#fbf1e0" },
        danger: { 600: "#b53528", 500: "#d6493b", 50: "#fbe9e7" },
        info: { 500: "#0d9aa8" },
        accent: { 600: "#5b3fb0", 500: "#7c5cdb", 50: "#efe9fb" },
      },
      borderRadius: { sm: "6px", md: "10px", lg: "14px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,31,58,0.04), 0 1px 3px rgba(16,31,58,0.06)",
        pop: "0 8px 24px rgba(16,31,58,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
