// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getAvailableRooms } from '@/lib/services/reservation-service';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const roomTypeId = searchParams.get('roomTypeId');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');

  if (!roomTypeId || !checkIn || !checkOut) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'roomTypeId, checkIn, and checkOut are required' }, { status: 400 });
  }

  return NextResponse.json(
    await getAvailableRooms(actor, {
      roomTypeId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
    }),
  );
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
