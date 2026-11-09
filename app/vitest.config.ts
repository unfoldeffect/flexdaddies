import { defineConfig } from "vitest/config";

// Unit tests for the app's pure helpers. Kept separate from vite.config.ts so
// tests don't load the TanStack Start / Cloudflare build plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
