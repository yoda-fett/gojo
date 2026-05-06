import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/web/vitest.config.ts',
  'apps/api/vitest.config.ts',
  'packages/db/vitest.config.ts',
  'packages/types/vitest.config.ts',
]);
