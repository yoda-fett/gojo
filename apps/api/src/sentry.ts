import * as Sentry from '@sentry/node';

import { env } from './env.js';

export function initSentry() {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}
