// @ts-nocheck
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { PropertyProfileClient } from './_components/property-profile-client';

// Settings → Property Profile (Story 12.7b). RSC loads current property +
// cancellation policies; the /settings RBAC guard lives in the group layout.
export default async function PropertyProfilePage() {
  const actor = await getServerActor();
  if (!actor) {
    return null;
  }

  const [property, policies] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: {
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
        routineCleaningIntervalDays: true,
        costConfig: true,
      },
    }),
    prisma.cancellationPolicy.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
  ]);

  if (!property) {
    return null;
  }

  // Serialize for the client form — Prisma Decimal cannot cross the
  // Server → Client Component boundary.
  const policiesForForm = policies.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    windowHours: p.windowHours,
    penaltyType: p.penaltyType,
    penaltyValue: p.penaltyValue == null ? null : Number(p.penaltyValue),
    isDefault: p.isDefault,
  }));

  const archetype =
    property.costConfig && typeof property.costConfig === 'object'
      ? ((property.costConfig as { archetype?: string }).archetype ?? null)
      : null;

  return (
    <PropertyProfileClient
      propertyId={property.id}
      property={property}
      archetype={archetype}
      initialPolicies={policiesForForm}
    />
  );
}
