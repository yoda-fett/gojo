// @ts-nocheck
import { checkSubscriptionGate, prisma, assertHousekeepingTransition, withIdempotency } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { transitionRoomState } from '@/lib/services/room-state';
import { publishSseEvent } from '@/lib/services/sse-publisher';

const schema = z.object({
  toState: z.enum(['CLEAN', 'DIRTY']),
  stateVersion: z.number().int().nonnegative(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    await checkSubscriptionGate(actor, 'room.updateHousekeepingStatus', prisma);
    try {
      const body = schema.parse(await request.json());
      const idempotencyKey = request.headers.get('idempotency-key');

      const room = await prisma.room.findFirst({
        where: { id, propertyId: actor.propertyId, deletedAt: null },
      });
      if (!room) {
        return NextResponse.json({ code: 'NOT_FOUND', message: 'Room not found' }, { status: 404 });
      }

      assertHousekeepingTransition(room.housekeepingStatus, body.toState, actor.role);

      const mutate = async () => {
        await prisma.$transaction(async (tx) => {
        await transitionRoomState(tx, actor, {
          roomId: id,
          expectedStateVersion: body.stateVersion,
          fromState: room.housekeepingStatus,
          toState: body.toState,
          action: 'HOUSEKEEPING_STATUS_UPDATED',
          metadata: { roomId: id },
        });
      });
        return { ok: true, state: body.toState, stateVersion: body.stateVersion + 1 };
      };

      const result = idempotencyKey
        ? await withIdempotency(`room-status:v1:${actor.propertyId}:${id}:${idempotencyKey}`, prisma, mutate)
        : await mutate();

      await publishSseEvent(actor.propertyId, {
        entityType: 'Room',
        entityId: id,
        stateVersion: body.stateVersion + 1,
        state: body.toState,
        eventType: 'HOUSEKEEPING_STATUS_UPDATED',
      });

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }, ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'])(req as never);
}
