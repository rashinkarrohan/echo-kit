import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Root config: individual packages override this via their own vitest.config.ts
    // We rely on `pnpm -r test` to run per-package configs.
    include: [],
  },
});
