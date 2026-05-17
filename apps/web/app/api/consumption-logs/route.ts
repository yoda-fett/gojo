// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { logConsumptionRefill } from '@/lib/services/housekeeping-consumption';

const Body = z.object({
  roomId: z.string().min(1),
  reservationId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        catalogItemId: z.string().min(1),
        qtyAddedToReachPar: z.number().int().min(0).max(1000),
      }),
    )
    .min(1),
  evidence: z.unknown().optional(),
});

export const POST = withAuth(async (req, actor) => {
  const idempotencyKey = req.headers.get('idempotency-key') ?? crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());
    const result = await logConsumptionRefill(actor, { ...body, idempotencyKey });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }
    throw error;
  }
}, 'HOUSEKEEPING');
