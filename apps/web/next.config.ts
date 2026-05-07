import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint runs in CI / `pnpm lint`, not as a build gate. The codebase carries
  // long-standing typed-lint warnings (mostly in `@ts-nocheck` files) that
  // would otherwise block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: 'gojo',
  project: 'web',
  silent: true,
});
