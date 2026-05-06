// @ts-nocheck
import { NextResponse } from 'next/server';

import { sweepExpiredBlocks } from '@/lib/services/room-blocks';

export async function POST() {
  const released = await sweepExpiredBlocks();
  return NextResponse.json({ released });
}
