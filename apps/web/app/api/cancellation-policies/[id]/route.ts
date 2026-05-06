// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, cancellationPolicySchema } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const body = cancellationPolicySchema.parse(await req.json());
    const { id } = await context.params;
    const existing = await prisma.cancellationPolicy.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Cancellation policy not found', 404);
    }

    const updated = await prisma.cancellationPolicy.update({
      where: { id },
      data: body,
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'CANCELLATION_POLICY',
        entityId: id,
        action: 'UPDATE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    const existing = await prisma.cancellationPolicy.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Cancellation policy not found', 404);
    }

    const inUse = await prisma.reservation.count({
      where: {
        propertyId: actor.propertyId,
        selectedCancellationPolicyId: id,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });

    if (inUse > 0) {
      throw new AppError('CANCELLATION_POLICY_IN_USE', 'Cancellation policy is in use', 409);
    }

    const deleted = await prisma.cancellationPolicy.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'CANCELLATION_POLICY',
        entityId: id,
        action: 'DELETE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
