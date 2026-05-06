import * as Sentry from '@sentry/nextjs';

import { env } from './env';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
