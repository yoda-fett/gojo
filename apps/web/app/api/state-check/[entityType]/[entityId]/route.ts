// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

type Context = { params: Promise<{ entityType: string; entityId: string }> };

export async function GET(req: Request, context: Context) {
  const { entityType, entityId } = await context.params;
  return withAuth(async (_request, actor) => {
    let entity: { id: string; stateVersion?: number; state?: string; status?: string; propertyId: string } | null = null;
    if (entityType === 'Room') {
      entity = await prisma.room.findFirst({
        where: { id: entityId, propertyId: actor.propertyId, deletedAt: null },
      });
    } else if (entityType === 'Reservation') {
      entity = await prisma.reservation.findFirst({
        where: { id: entityId, propertyId: actor.propertyId, deletedAt: null },
      });
    } else if (entityType === 'Folio') {
      entity = await prisma.folio.findFirst({
        where: { id: entityId, propertyId: actor.propertyId, deletedAt: null },
      });
    }
    if (!entity) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      entityType,
      entityId,
      stateVersion: entity.stateVersion ?? 0,
      state: entity.state ?? entity.status ?? null,
    });
  })(req as never);
}
