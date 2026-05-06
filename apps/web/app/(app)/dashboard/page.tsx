// @ts-nocheck
import { SetupChecklistLoader } from '@/components/onboarding/setup-checklist-loader';
import { getServerActor } from '@/lib/auth/server-actor';
import { getDashboardSnapshot } from '@/lib/dashboard/data';
import { buildRange } from '@/lib/dashboard/date-range';
import { prisma } from '@gojo/db';

import { DashboardClient } from './_components/dashboard-client';

export default async function DashboardPage() {
  const actor = await getServerActor();

  if (!actor) {
    return null;
  }

  const [initial, roomTypes, cancellationPolicies] = await Promise.all([
    getDashboardSnapshot(actor.propertyId, actor.role, buildRange('today')),
    prisma.roomType.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.cancellationPolicy.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);
  const minimumSetupComplete = roomTypes > 0 && cancellationPolicies > 0;

  if (!minimumSetupComplete) {
    return <SetupChecklistLoader propertyId={actor.propertyId} />;
  }

  return <DashboardClient propertyId={actor.propertyId} role={actor.role} initial={initial} />;
}
