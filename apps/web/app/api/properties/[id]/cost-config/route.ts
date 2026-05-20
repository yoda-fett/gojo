// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const schema = z.object({
  archetype: z.enum(['BUDGET_GUESTHOUSE', 'MID_MARKET_HOTEL', 'BOUTIQUE_PROPERTY', 'CUSTOM']),
  fixedCosts: z.object({
    rentOrMortgage: z.number().min(0),
    staffSalaries: z.number().min(0),
    insurance: z.number().min(0),
    utilitiesBase: z.number().min(0),
    other: z.number().min(0),
  }),
  variableCosts: z.object({
    housekeepingSupplies: z.number().min(0),
    laundry: z.number().min(0),
    amenities: z.number().min(0),
    utilitiesVariable: z.number().min(0),
    other: z.number().min(0),
  }),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => {
    if (id !== actor.propertyId) {
      return NextResponse.json({ code: 'PROPERTY_ACCESS_DENIED', message: 'No access to this property' }, { status: 403 });
    }

    const property = await prisma.property.findFirst({
      where: { id, deletedAt: null },
      select: { costConfig: true },
    });

    return NextResponse.json({ costConfig: property?.costConfig ?? null });
  }, ['OWNER'])(req as never);
}

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    if (id !== actor.propertyId) {
      return NextResponse.json({ code: 'PROPERTY_ACCESS_DENIED', message: 'No access to this property' }, { status: 403 });
    }

    const body = schema.parse(await request.json());
    await checkSubscriptionGate(actor, 'cost_config.update', prisma);

    const [prev, totalRooms] = await Promise.all([
      prisma.property.findFirst({ where: { id, deletedAt: null } }),
      prisma.room.count({ where: { propertyId: id, deletedAt: null } }),
    ]);

    const costConfig = {
      version: '1',
      archetype: body.archetype,
      fixedCosts: body.fixedCosts,
      variableCosts: body.variableCosts,
      totalRooms,
      updatedAt: new Date().toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { costConfig },
      });

      await tx.auditLog.create({
        data: {
          propertyId: actor.propertyId,
          entityType: 'PROPERTY',
          entityId: id,
          action: 'COST_CONFIG_UPDATED',
          actorId: actor.userId,
          actorRole: actor.role,
          metadata: {
            before: prev?.costConfig ?? null,
            after: costConfig,
          },
        },
      });
    });

    return NextResponse.json({ costConfig });
  }, ['OWNER'])(req as never);
}
