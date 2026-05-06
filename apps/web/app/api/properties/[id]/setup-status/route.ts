// @ts-nocheck
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER', 'FRONT_DESK'])(req);
    const { id } = await context.params;

    if (id !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    const [roomTypes, cancellationPolicies, teamMembers] = await Promise.all([
      prisma.roomType.count({ where: { propertyId: id, deletedAt: null } }),
      prisma.cancellationPolicy.count({ where: { propertyId: id, deletedAt: null } }),
      prisma.propertyAccess.count({
        where: {
          propertyId: id,
          deletedAt: null,
          revokedAt: null,
          status: 'ACTIVE',
          role: { not: 'OWNER' },
        },
      }),
    ]);

    return NextResponse.json({
      roomTypesConfigured: roomTypes > 0,
      cancellationPoliciesConfigured: cancellationPolicies > 0,
      teamInvited: teamMembers > 0,
      minimumSetupComplete: roomTypes > 0 && cancellationPolicies > 0,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
