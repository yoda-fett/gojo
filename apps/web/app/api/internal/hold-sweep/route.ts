// @ts-nocheck
import { NextResponse } from 'next/server';

import { sweepExpiredHolds } from '@/lib/services/direct-booking';

export async function POST() {
  const released = await sweepExpiredHolds();
  return NextResponse.json({ released });
}
