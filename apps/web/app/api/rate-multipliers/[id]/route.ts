// @ts-nocheck
// Story 12.7f. Update + soft-delete a rate multiplier.
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError, rateMultiplierSchema } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

async function loadOwned(actor, id) {
  const existing = await prisma.rateMultiplier.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Rate multiplier not found', 404);
  return existing;
}

export async function PUT(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const body = rateMultiplierSchema.parse(await req.json());
    const { id } = await context.params;
    await loadOwned(actor, id);

    const updated = await prisma.rateMultiplier.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        multiplier: body.multiplier,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        channel: body.channel ?? null,
        roomTypeIds: body.roomTypeIds,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'RATE_MULTIPLIER',
        entityId: id,
        action: 'UPDATE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    if (error instanceof z.ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request' }, { status: 422 });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    await loadOwned(actor, id);

    const deleted = await prisma.rateMultiplier.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'RATE_MULTIPLIER',
        entityId: id,
        action: 'DELETE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
