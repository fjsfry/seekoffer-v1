import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    exclude: [
      // Pro/billing is a separate website product line and is intentionally
      // absent from the desktop-only release-source commit.
      'tests/desktop-pro-design.test.ts'
    ]
  }
});
