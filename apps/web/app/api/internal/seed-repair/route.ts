// @ts-nocheck
import { NextResponse } from 'next/server';

import { reconcileData } from '@/lib/services/data-reconciliation';

// Post-seed data-integrity reconciliation. Run manually after seeding.
// Idempotent — safe to run repeatedly.
export async function POST() {
  const result = await reconcileData();
  return NextResponse.json(result);
}
