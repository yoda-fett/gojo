import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

function optionalString(schema: z.ZodTypeAny) {
  return z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }

    return value;
  }, schema.optional());
}

function formatIssuePath(path: readonly unknown[] | undefined) {
  if (!path || path.length === 0) {
    return 'env';
  }

  return path.map((segment) => String(segment)).join('.');
}

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OTP_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
    MSG91_AUTH_KEY: optionalString(z.string()),
    MSG91_TEMPLATE_ID: optionalString(z.string()),
    REDIS_URL: optionalString(z.string().url()),
    SENTRY_DSN: optionalString(z.string().url()),
    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(480).default(480),
  },
  client: {
    NEXT_PUBLIC_APP_URL: optionalString(z.string().url()),
  },
  runtimeEnv: {
    DATABASE_URL: process.env['DATABASE_URL'],
    JWT_SECRET: process.env['JWT_SECRET'],
    OTP_PROVIDER: process.env['OTP_PROVIDER'],
    MSG91_AUTH_KEY: process.env['MSG91_AUTH_KEY'],
    MSG91_TEMPLATE_ID: process.env['MSG91_TEMPLATE_ID'],
    NODE_ENV: process.env['NODE_ENV'],
    REDIS_URL: process.env['REDIS_URL'],
    SENTRY_DSN: process.env['SENTRY_DSN'],
    SESSION_IDLE_TIMEOUT_MINUTES: process.env['SESSION_IDLE_TIMEOUT_MINUTES'],
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  },
  onValidationError(issues) {
    throw new Error(issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`).join('; '));
  },
});

if (env.OTP_PROVIDER === 'msg91' && (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID)) {
  throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required when OTP_PROVIDER=msg91');
}
