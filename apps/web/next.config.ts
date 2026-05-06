import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
};

export default withSentryConfig(nextConfig, {
  org: 'gojo',
  project: 'web',
  silent: true,
});
