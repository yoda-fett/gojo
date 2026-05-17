// @ts-nocheck
// Story 10.2d: Owner endpoint to view + edit the conversion-arc touchpoint
// schedule. PATCH validates via Zod, audit-logs the change, and reschedules
// any already-queued nudge jobs.

import {
  checkSubscriptionGate,
  prisma,
  rescheduleConversionArcJobs,
  writeAuditLog,
} from '@gojo/db';
import { AppError, ConversionArcConfigSchema } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

function idFromContext(context: unknown) {
  return (context as { params?: Promise<{ id: string }> })?.params;
}

export const GET = withAuth(async (_req, actor, context) => {
  const params = await idFromContext(context);
  if (params?.id !== actor.propertyId) {
    throw new AppError('FORBIDDEN', 'Cannot read another property', 403);
  }
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: { conversionArcConfig: true },
  });
  if (!property) {
    throw new AppError('NOT_FOUND', 'Property not found', 404);
  }
  return NextResponse.json({ conversionArcConfig: property.conversionArcConfig });
});

export const PATCH = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'property.update', prisma);
  const params = await idFromContext(context);
  if (params?.id !== actor.propertyId) {
    throw new AppError('FORBIDDEN', 'Cannot update another property', 403);
  }

  const body = await req.json();
  const result = ConversionArcConfigSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError('VALIDATION_ERROR', 'Invalid conversion arc config', 422, {
      details: { field: issue?.path.join('.') || 'body', reason: issue?.message },
    });
  }

  await prisma.$transaction(async (tx) => {
    const before = await tx.property.findUnique({
      where: { id: params.id },
      select: { conversionArcConfig: true },
    });
    await tx.property.update({
      where: { id: params.id },
      data: { conversionArcConfig: result.data },
    });
    await writeAuditLog(tx, actor, {
      action: 'CONVERSION_ARC_CONFIG_UPDATED',
      entityType: 'PROPERTY',
      entityId: params.id,
      before: { conversionArcConfig: before?.conversionArcConfig ?? null },
      after: { conversionArcConfig: result.data },
    });
  });

  // Reschedule outside the transaction; failures are logged, not thrown
  // — the persisted config is the source of truth.
  try {
    await rescheduleConversionArcJobs(prisma, params.id);
  } catch (err) {
    console.warn('[conversion-arc] reschedule failed', err);
  }

  return NextResponse.json({ ok: true, conversionArcConfig: result.data });
});
