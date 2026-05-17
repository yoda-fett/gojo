import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

function formatIssuePath(path: readonly unknown[] | undefined) {
  if (!path || path.length === 0) {
    return 'env';
  }

  return path.map((segment) => String(segment)).join('.');
}

const baseEnv = createEnv({
  server: {
    JWT_SECRET: z.string().min(32),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_WHATSAPP_INTEGRATED_NUMBER: z.string().optional(),
    MSG91_WHATSAPP_NAMESPACE: z.string().optional(),
    MSG91_WHATSAPP_TEMPLATE_NAME: z.string().optional().default('gojo_trial_nudge_v1'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OTP_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
    REDIS_URL: z.string().url().optional(),
    RENDER_SSE_BASE_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),
    SENTRY_DSN: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  onValidationError(issues) {
    throw new Error(issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`).join('; '));
  },
});

if (baseEnv.OTP_PROVIDER === 'msg91' && !baseEnv.MSG91_AUTH_KEY) {
  throw new Error('MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91');
}

if (baseEnv.NODE_ENV === 'production' && !baseEnv.RENDER_SSE_BASE_URL) {
  throw new Error('RENDER_SSE_BASE_URL is required when NODE_ENV=production');
}

export const env = baseEnv;
