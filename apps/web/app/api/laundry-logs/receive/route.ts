// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { getLaundryReceiveSnapshot, receiveLaundry } from '@/lib/services/housekeeping-laundry';

const Body = z.object({
  items: z
    .array(
      z.object({
        catalogItemId: z.string().min(1),
        receivedQty: z.number().int().min(0).max(100000),
      }),
    )
    .min(1),
  evidence: z.unknown().optional(),
});

export const GET = withAuth(async (_req, actor) => {
  return NextResponse.json(await getLaundryReceiveSnapshot(actor));
}, 'HOUSEKEEPING');

export const POST = withAuth(async (req, actor) => {
  const idempotencyKey = req.headers.get('idempotency-key') ?? crypto.randomUUID();
  try {
    const body = Body.parse(await req.json());
    const result = await receiveLaundry(actor, { ...body, idempotencyKey });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }
    throw error;
  }
}, 'HOUSEKEEPING');
