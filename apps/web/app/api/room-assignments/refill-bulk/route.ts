import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { generateRefillAssignments } from '@/lib/services/housekeeping-room-stock';

export const POST = withAuth(async (req, actor) => {
  const body = await req.json();
  const result = await generateRefillAssignments(actor, {
    ...body,
    idempotencyKey: req.headers.get('idempotency-key') ?? body.idempotencyKey,
  });
  return NextResponse.json(result, { status: 201 });
}, ['OWNER', 'MANAGER']);
