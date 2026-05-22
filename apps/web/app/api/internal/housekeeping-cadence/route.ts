// Story 15.7 — POST /api/internal/housekeeping-cadence.
//
// Daily third-party-cron entry point for the scheduled DIRTY rules (R2/R3).
// A mass-mutation endpoint, so it is guarded by a `CRON_SECRET` bearer check
// (solution model §8.3) — unlike the older internal routes, which have none.

import { NextResponse } from 'next/server';

import { env } from '@/env';
import { runHousekeepingCadence } from '@/lib/services/housekeeping-cadence-job';

export async function POST(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    // Fail closed — a mass-mutation endpoint must never run unauthenticated.
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'CRON_SECRET is not configured' },
      { status: 503 },
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing cron credentials' },
      { status: 401 },
    );
  }

  const summary = await runHousekeepingCadence();
  return NextResponse.json(summary);
}
