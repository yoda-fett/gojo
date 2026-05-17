import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(dirname, '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint runs in CI / `pnpm lint`, not as a build gate. The codebase carries
  // long-standing typed-lint warnings (mostly in `@ts-nocheck` files) that
  // would otherwise block production builds. Mirrors apps/web.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Walk up to the monorepo root so the file tracer can follow workspace
  // symlinks into packages/db (Prisma client lives there).
  outputFileTracingRoot: monorepoRoot,
  // Bundle the Prisma Query Engine binary into the serverless function.
  // Include patterns are relative to outputFileTracingRoot (monorepo root).
  // We explicitly list BOTH the canonical source (packages/db) and the
  // pre-build copy target (apps/housekeeping/src/generated/client) so Vercel's
  // tracer picks the engine up no matter which path it walks.
  outputFileTracingIncludes: {
    '/**/*': [
      'packages/db/src/generated/client/*.so.node',
      'packages/db/src/generated/client/schema.prisma',
      'apps/housekeeping/src/generated/client/*.so.node',
      'apps/housekeeping/src/generated/client/schema.prisma',
    ],
  },
  // Don't bundle Prisma — keep it as a runtime require so the .node engine
  // binary is loaded from the file system instead of webpack.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
};

export default nextConfig;
