import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    exclude: [
      "**/node_modules/**",
      "**/.claude/worktrees/**",
      "**/dist/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
