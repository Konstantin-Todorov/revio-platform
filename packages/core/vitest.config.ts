import { defineConfig } from "vitest/config";

export default defineConfig({
  // The source uses NodeNext-style ".js" specifiers that point at ".ts" files.
  resolve: { extensionAlias: { ".js": [".ts", ".js"] } },
  test: { include: ["src/**/*.test.ts"] },
});
