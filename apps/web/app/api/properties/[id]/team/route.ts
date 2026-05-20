// @ts-nocheck
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { getOtpProvider } from '@/lib/otp/factory';
import { maskPhone } from '@/lib/utils/mask-phone';

import { requireRole } from '@/lib/auth/require-role';

const inviteSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  // OWNER is invitable as a co-owner — full owner access to this property.
  role: z.enum(['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    if (id !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    const accessList = await prisma.propertyAccess.findMany({
      where: {
        propertyId: id,
        deletedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = await Promise.all(
      accessList.map(async (access: { userId: string; role: string; status: string; invitedAt: Date | null }) => {
        const user = await prisma.user.findUnique({ where: { id: access.userId } });
        return {
          // userId is included for action wiring (DELETE/resend) only — the UI never renders it.
          userId: access.userId,
          displayName: user?.name ?? null,
          phoneMasked: maskPhone(user?.phone ?? ''),
          role: access.role,
          status: access.status,
          invitedAt: access.invitedAt,
          isSelf: access.userId === actor.userId,
        };
      }),
    );

    return NextResponse.json(rows);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole('OWNER')(req);
    const { id } = await context.params;
    if (id !== actor.propertyId) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    const body = inviteSchema.parse(await req.json());
    const user = await prisma.user.upsert({
      where: { phone: body.phone },
      update: {},
      create: { phone: body.phone },
    });

    const existing = await prisma.propertyAccess.findUnique({
      where: {
        propertyId_userId: {
          propertyId: id,
          userId: user.id,
        },
      },
    });

    if (existing?.status === 'ACTIVE' && !existing.revokedAt && !existing.deletedAt) {
      throw new AppError('TEAM_MEMBER_ALREADY_EXISTS', 'Team member already exists', 409);
    }

    const access = existing
      ? await prisma.propertyAccess.update({
          where: {
            propertyId_userId: {
              propertyId: id,
              userId: user.id,
            },
          },
          data: {
            role: body.role,
            status: 'PENDING',
            invitedAt: new Date(),
            invitedBy: actor.userId,
            revokedAt: null,
            deletedAt: null,
            deletedBy: null,
          },
        })
      : await prisma.propertyAccess.create({
          data: {
            propertyId: id,
            userId: user.id,
            role: body.role,
            status: 'PENDING',
            invitedAt: new Date(),
            invitedBy: actor.userId,
          },
        });

    const provider = await getOtpProvider();
    const providerResult = await provider.sendOtp(body.phone);
    const otpHash = await hash('987654', 10);
    await prisma.otpSession.create({
      data: {
        sessionId: nanoid(),
        phone: body.phone,
        otpHash,
        providerRequestId: providerResult.requestId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        invitationPropertyId: id,
        invitationRole: body.role,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: id,
        entityType: 'TEAM',
        entityId: user.id,
        action: 'INVITE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json({ userId: user.id, status: access.status });
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
