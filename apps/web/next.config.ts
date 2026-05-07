import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint runs in CI / `pnpm lint`, not as a build gate. The codebase carries
  // long-standing typed-lint warnings (mostly in `@ts-nocheck` files) that
  // would otherwise block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Bundle the Prisma Query Engine binary into the serverless function.
  // Next's file tracer otherwise misses it when @gojo/db lives in a sibling
  // workspace package.
  outputFileTracingIncludes: {
    '/**/*': [
      '../../packages/db/src/generated/client/libquery_engine-*.so.node',
      '../../packages/db/src/generated/client/schema.prisma',
    ],
  },
  // Don't try to bundle Prisma — keep it as a runtime require so the .node
  // engine binary is loaded from the file system.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};

export default withSentryConfig(nextConfig, {
  org: 'gojo',
  project: 'web',
  silent: true,
});
