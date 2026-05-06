// @ts-nocheck
import { NextResponse } from 'next/server';

import { expireRotatingSecrets } from '@/lib/services/channels';

export async function POST() {
  const expired = await expireRotatingSecrets();
  return NextResponse.json({ expired });
}
