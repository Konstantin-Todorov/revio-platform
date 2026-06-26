import { defineConfig } from "vitest/config";

export default defineConfig({
  // Workspace packages import each other with NodeNext ".js" specifiers; resolve them to ".ts".
  resolve: { extensionAlias: { ".js": [".ts", ".js"] } },
  test: { include: ["src/**/*.test.ts"] },
});
