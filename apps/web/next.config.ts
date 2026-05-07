import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(dirname, '../..');

const nextConfig: NextConfig = {
  // Lint runs in CI / `pnpm lint`, not as a build gate. The codebase carries
  // long-standing typed-lint warnings (mostly in `@ts-nocheck` files) that
  // would otherwise block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Walk up to the monorepo root so the file tracer can follow workspace
  // symlinks into packages/db (Prisma client lives there).
  outputFileTracingRoot: monorepoRoot,
  // Bundle the Prisma Query Engine binary into the serverless function.
  outputFileTracingIncludes: {
    '/**/*': [
      'packages/db/src/generated/client/libquery_engine-*.so.node',
      'packages/db/src/generated/client/schema.prisma',
    ],
  },
  // Don't bundle Prisma — keep it as a runtime require so the .node engine
  // binary is loaded from the file system instead of webpack.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};

export default withSentryConfig(nextConfig, {
  org: 'gojo',
  project: 'web',
  silent: true,
});
