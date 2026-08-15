import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

/**
 * The lint config (X3).
 *
 * ## Why this file exists
 *
 * `pnpm lint` used to run `pnpm -r lint`, and **not one of the thirteen packages defined a `lint`
 * script**. pnpm printed "None of the selected packages has a lint script" and exited 0. So the repo
 * had a lint command that passed forever while checking nothing — the same failure as the copy-lint
 * script that once reported "clean" after scanning zero files. A green check that cannot go red is
 * worse than no check, because it is trusted.
 *
 * So the root script is now `eslint .` against this config. It lints real files or it fails; there
 * is no third outcome.
 *
 * ## Why the rule set is small
 *
 * Turning on everything at once on a codebase this size produces hundreds of findings, which get
 * suppressed in bulk, which leaves you back where you started with extra config. Every rule below
 * either catches a real defect or enforces something this codebase already does. Add rules when
 * something bites, not speculatively.
 *
 * Deliberately NOT enabled: `recommendedTypeChecked`. Its best rules (`no-floating-promises`,
 * `no-misused-promises`) genuinely matter in a codebase this async — but they need type information
 * for every file, which makes a lint run cost about as much as a build. Worth revisiting as a
 * separate, slower CI job.
 */
export default tseslint.config(
  {
    // Generated, vendored or built output. Linting these finds nothing and hides everything.
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.d.ts",
      "packages/db/src/generated/**",
      "design/**",
      "docs/**",
      // Somebody else's code, kept as the record of what was handed over. Linting it would report
      // findings nobody is going to act on, and that noise is exactly what makes a lint run ignorable.
      "_intake/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,mjs,js}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      /*
       * An unused variable is usually a rename that was only half finished, or a value someone meant
       * to use. Underscore-prefixed names are the documented way to say "deliberately ignored", which
       * matters most for `catch (_err)` — this codebase swallows errors on purpose in several places
       * (a channel push must never fail a booking) and each of those is a decision, not an oversight.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      /*
       * `any` is allowed but visible. There are a small number of honest ones — the RLS proxy in each
       * app forwards `prisma.<model>.<op>` dynamically and cannot be typed without generating the
       * whole Prisma surface by hand. A warning keeps those readable without failing the build; if
       * the count starts climbing, that is the signal to make this an error.
       */
      "@typescript-eslint/no-explicit-any": "warn",

      /*
       * Money is integer minor units in this codebase, and `==` between a number and a numeric string
       * is exactly how a cent goes missing. `null` is exempted so `x != null` keeps working — it is
       * the idiomatic "neither null nor undefined" and reads better than the alternative.
       */
      eqeqeq: ["error", "always", { null: "ignore" }],

      /*
       * `console.log` left in a server action ends up in production logs, sometimes with a guest's
       * details in it. Warn, and allow the three that are deliberate output.
       */
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],

      // Real bugs, not style: a duplicated case, a shadowed builtin, an unreachable branch.
      "no-fallthrough": "error",
      "no-unsafe-optional-chaining": "error",
    },
  },
  {
    /*
     * The React and Next plugins, for the app code only.
     *
     * These are not decoration. Several components already carry
     * `// eslint-disable-next-line react-hooks/exhaustive-deps` and `@next/next/no-img-element`
     * comments — written against `eslint-config-next`, which was never actually wired up. So those
     * suppressions were suppressing nothing, and ESLint reported the rule as not found. Loading the
     * plugins makes the existing comments mean what their authors intended, and turns on
     * `exhaustive-deps`, which catches a genuinely nasty class of stale-closure bug.
     */
    files: ["apps/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": next },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      // `<img>` over `next/image` is a deliberate choice in a few places (a hotel's own uploaded
      // logo, a maintenance photo from object storage) where the optimiser adds nothing. Warn so the
      // decision stays visible without failing the build.
      "@next/next/no-img-element": "warn",
    },
  },
  {
    /*
     * Scripts are operator tools — they print to stdout because printing IS their output, and they
     * run in Node with no browser globals. Verification scripts especially: `claim-verify` and
     * `rls-verify` communicate entirely through `console.log`.
     */
    files: ["**/scripts/**", "**/*.config.{js,mjs,ts}", "packages/db/prisma/seed.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Tests assert on shapes that are deliberately wrong, and mock objects are rarely fully typed.
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
