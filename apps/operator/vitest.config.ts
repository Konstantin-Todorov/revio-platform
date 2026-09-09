import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest needs the same `@/` alias Next resolves from `tsconfig.json`.
 *
 * Without it a test can only import modules by relative path, which is fine for a pure function but
 * rules out rendering a **component** — every component here imports `@/components/ui/primitives`,
 * so the alias fails inside the file under test rather than in the test itself, and the error names
 * a path nobody wrote.
 *
 * Purely additive: every existing test uses relative imports and resolves exactly as before.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  /*
   * The automatic JSX runtime, which is what Next itself uses.
   *
   * esbuild otherwise defaults to the classic transform, so every component under test needs a
   * `React` global that nothing in the app provides — the failure is `ReferenceError: React is not
   * defined` pointing at a `return (` inside a component file, which reads as a bug in the component
   * rather than a missing test setting.
   */
  esbuild: { jsx: "automatic" },
});
