import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { extensionAlias: { ".js": [".ts", ".js"] } },
  test: { include: ["test/**/*.test.ts"], fileParallelism: false, testTimeout: 20000 },
});
