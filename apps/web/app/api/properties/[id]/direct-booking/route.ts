// @ts-nocheck
import { prisma, writeAuditLog } from '@gojo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { generateUniqueBookingSlug } from '@/lib/services/direct-booking';

const schema = z.object({
  enabled: z.boolean(),
  averageOtaCommissionRate: z.number().min(0).max(1).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    if (id !== actor.propertyId) {
      return NextResponse.json({ code: 'PROPERTY_ACCESS_DENIED', message: 'No access to this property' }, { status: 403 });
    }

    const body = schema.parse(await request.json());
    const property = await prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!property) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Property not found' }, { status: 404 });
    }

    let bookingSlug = property.bookingSlug;
    if (body.enabled && !bookingSlug) {
      bookingSlug = await generateUniqueBookingSlug(property.name);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.property.update({
        where: { id },
        data: {
          directBookingEnabled: body.enabled,
          bookingSlug,
          ...(body.averageOtaCommissionRate !== undefined
            ? { averageOtaCommissionRate: body.averageOtaCommissionRate }
            : {}),
        },
      });
      await writeAuditLog(tx, actor, {
        action: body.enabled ? 'CHANNEL_CONNECTED' : 'CHANNEL_DISCONNECTED',
        entityType: 'DIRECT_BOOKING',
        entityId: id,
        before: { directBookingEnabled: property.directBookingEnabled, bookingSlug: property.bookingSlug },
        after: { directBookingEnabled: next.directBookingEnabled, bookingSlug: next.bookingSlug },
      });
      return next;
    });

    return NextResponse.json({
      directBookingEnabled: updated.directBookingEnabled,
      bookingSlug: updated.bookingSlug,
      averageOtaCommissionRate: updated.averageOtaCommissionRate,
    });
  }, ['OWNER'])(req as never);
}
