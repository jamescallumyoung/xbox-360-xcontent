import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // Temporary: there are no tests until stage 2b, which removes this.
    passWithNoTests: true,
  },
})
