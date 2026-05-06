// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { createWalkInReservation } from '@/lib/services/reservation-service';

const walkInSchema = z.object({
  guestName: z.string().min(1),
  guestPhone: z.string().min(10),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  roomTypeId: z.string().min(1),
  roomId: z.string().min(1),
  rate: z.number().positive(),
  belowFloorOverride: z.boolean().optional(),
  selectedCancellationPolicyId: z.string().optional(),
});

export const POST = withAuth(async (req, actor) => {
  const body = walkInSchema.parse(await req.json());
  const reservation = await createWalkInReservation(actor, {
    ...body,
    checkIn: new Date(body.checkIn),
    checkOut: new Date(body.checkOut),
  });
  return NextResponse.json({ data: { reservation } });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
