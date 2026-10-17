import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // Restore globals replaced with vi.stubGlobal (such as reportError) after each test.
    unstubGlobals: true,
  },
});
