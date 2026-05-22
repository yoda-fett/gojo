import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': dirname,
    },
  },
  // Use the automatic JSX runtime so components need not import React — matches
  // the Next.js build and the project's `jsx` convention.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    passWithNoTests: true,
  },
});
