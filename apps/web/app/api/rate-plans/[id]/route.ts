// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError, ratePlanSchema } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const body = ratePlanSchema.parse(await req.json());
    const { id } = await context.params;
    const existing = await prisma.ratePlan.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Rate plan not found', 404);
    }

    const updated = await prisma.ratePlan.update({
      where: { id },
      data: {
        ...body,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'RATE_PLAN',
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

    if (error instanceof z.ZodError) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request' }, { status: 422 });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    const existing = await prisma.ratePlan.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new AppError('NOT_FOUND', 'Rate plan not found', 404);
    }

    const deleted = await prisma.ratePlan.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'RATE_PLAN',
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
