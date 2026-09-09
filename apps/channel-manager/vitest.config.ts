import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * RevioLink had no tests at all until 2026-09-09.
 *
 * That is not an oversight worth glossing over: the first real hotel lost a day to a bulk price
 * update that reported success and wrote nothing for one of their rate plans, and the rule it broke
 * — never offer a target the writer will silently discard — is a pure decision that a test can hold.
 * `pnpm --filter @revio/channel-manager test` had been answering with silence, which is its own
 * small version of the same problem.
 *
 * Same shape as the other apps: the `@/` alias Next resolves from `tsconfig.json`, plus the
 * automatic JSX runtime so a component can be rendered here too.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
});
