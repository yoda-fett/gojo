// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    const alert = await prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new AppError('NOT_FOUND', 'Alert not found', 404);
    }

    if (alert.propertyId !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this alert', 403);
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        dismissedBy: actor.userId,
        dismissedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ALERT',
        entityId: id,
        action: 'ALERT_DISMISSED',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
