// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { listReservations } from '@/lib/services/reservation-service';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.getAll('status');
  const source = searchParams.getAll('source');
  const roomType = searchParams.getAll('roomType');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const cursor = searchParams.get('cursor');
  const limit = Number(searchParams.get('limit') ?? 50);

  return NextResponse.json(
    await listReservations(actor, {
      status,
      source,
      roomType,
      from,
      to,
      cursor,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
    }),
  );
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
