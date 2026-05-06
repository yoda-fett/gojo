// @ts-nocheck
import { AppError, type Role } from '@gojo/types';
import type { NextRequest } from 'next/server';

import { prisma } from '@gojo/db';

import { getRedisClient } from '../redis';
import { getActor } from './get-actor';

export function requireRole(roles: Role | Role[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return async (req: NextRequest) => {
    const actor = await getActor(req);

    const access = await prisma.propertyAccess.findUnique({
      where: {
        propertyId_userId: {
          propertyId: actor.propertyId,
          userId: actor.userId,
        },
      },
    });

    if (!access || access.revokedAt || access.deletedAt || access.status !== 'ACTIVE') {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    try {
      const redis = getRedisClient();
      const revokedKey = await redis.get(`revoked:${actor.userId}:${actor.propertyId}`);
      if (revokedKey) {
        throw new AppError('UNAUTHORIZED', 'Access revoked', 401);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
    }

    if (!allowedRoles.includes(access.role as Role)) {
      throw new AppError('FORBIDDEN', 'Insufficient role', 403, {
        details: { requiredRole: allowedRoles[0] },
      });
    }

    return {
      ...actor,
      role: access.role as Role,
    };
  };
}
