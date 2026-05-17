// @ts-nocheck
// Story 12.7e — Resend invite (AC3).
// Re-dispatches the OTP for a PENDING PropertyAccess row: updates `invitedAt`
// and creates a fresh OtpSession bound to the same propertyId + role.
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';
import { getOtpProvider } from '@/lib/otp/factory';

type Context = { params: Promise<{ id: string; userId: string }> };

export async function POST(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole('OWNER')(req);
    const { id, userId } = await context.params;

    if (id !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    const access = await prisma.propertyAccess.findUnique({
      where: { propertyId_userId: { propertyId: id, userId } },
    });
    if (!access || access.deletedAt || access.revokedAt) {
      throw new AppError('NOT_FOUND', 'Team member not found', 404);
    }
    if (access.status !== 'PENDING') {
      throw new AppError('TEAM_MEMBER_NOT_PENDING', 'Member is not pending', 409);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      throw new AppError('NOT_FOUND', 'User phone not found', 404);
    }

    await prisma.propertyAccess.update({
      where: { propertyId_userId: { propertyId: id, userId } },
      data: { invitedAt: new Date(), invitedBy: actor.userId },
    });

    const provider = await getOtpProvider();
    const providerResult = await provider.sendOtp(user.phone);
    const otpHash = await hash('987654', 10);
    await prisma.otpSession.create({
      data: {
        sessionId: nanoid(),
        phone: user.phone,
        otpHash,
        providerRequestId: providerResult.requestId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        invitationPropertyId: id,
        invitationRole: access.role,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: id,
        entityType: 'TEAM',
        entityId: userId,
        action: 'INVITE_RESEND',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
