// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';
import { getRedisClient } from '@/lib/redis';

type Context = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole('OWNER')(req);
    const { id, userId } = await context.params;

    if (id !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    if (actor.userId === userId) {
      throw new AppError('CANNOT_REVOKE_SELF', 'Owner cannot revoke their own access', 403);
    }

    const access = await prisma.propertyAccess.findUnique({
      where: {
        propertyId_userId: {
          propertyId: id,
          userId,
        },
      },
    });

    if (!access || access.deletedAt || access.revokedAt) {
      throw new AppError('NOT_FOUND', 'Team member not found', 404);
    }

    const updated = await prisma.propertyAccess.update({
      where: {
        propertyId_userId: {
          propertyId: id,
          userId,
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await prisma.refreshToken.updateMany({
      where: {
        propertyId: id,
        userId,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    try {
      const redis = getRedisClient();
      await redis.set(`revoked:${userId}:${id}`, '1', 'EX', 60);
    } catch {
      // Fall back to DB-backed revocation when Redis is unavailable.
    }

    await prisma.auditLog.create({
      data: {
        propertyId: id,
        entityType: 'TEAM',
        entityId: userId,
        action: 'REVOKE',
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
