import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The `@/` alias Next resolves from `tsconfig.json`, plus the automatic JSX runtime.
 *
 * Without both, a test can only import plain functions: every component here imports
 * `@/components/...`, and esbuild's default classic JSX transform needs a `React` global that
 * nothing in the app provides. Purely additive — existing tests use relative imports and resolve
 * exactly as before.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
});
