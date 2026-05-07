import * as Sentry from '@sentry/nextjs';

// Read directly from process.env so this client-only file does not pull in
// the server-side env validator (which throws in the browser).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
