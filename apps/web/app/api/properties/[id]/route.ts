// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError, propertyProfileUpdateSchema } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

const PROPERTY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  contactPhone: true,
  contactEmail: true,
  gstin: true,
  pan: true,
  stateCode: true,
  currency: true,
  timezone: true,
  numberOfFloors: true,
  defaultCheckInTime: true,
  defaultCheckOutTime: true,
  laundryVendorName: true,
  laundryVendorContact: true,
} as const;

function idFromContext(context: unknown) {
  return (context as { params?: Promise<{ id: string }> })?.params;
}

export const PATCH = withAuth(async (req, actor, context) => {
  await checkSubscriptionGate(actor, 'property.update', prisma);
  const params = await idFromContext(context);
  if (params?.id !== actor.propertyId) {
    throw new AppError('FORBIDDEN', 'Cannot update another property', 403);
  }

  const result = propertyProfileUpdateSchema.safeParse(await req.json());
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError('VALIDATION_ERROR', 'Invalid property payload', 422, {
      details: { field: issue?.path.join('.') || 'body', reason: issue?.message },
    });
  }

  // Only persist keys the caller actually sent (partial / per-card update).
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result.data)) {
    if (value !== undefined) data[key] = value ?? null;
  }

  if (Object.keys(data).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No updatable fields provided', 400);
  }

  const property = await prisma.property.update({
    where: { id: actor.propertyId },
    data,
    select: PROPERTY_SELECT,
  });
  return NextResponse.json({ ok: true, property });
}, 'OWNER');
