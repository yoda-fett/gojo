// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { searchReservations } from '@/lib/services/reservation-service';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  return NextResponse.json(await searchReservations(actor, q));
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
