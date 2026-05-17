// @ts-nocheck
import { ColdStartBanner } from '@/components/onboarding/cold-start-banner';
import { SetupChecklistLoader } from '@/components/onboarding/setup-checklist-loader';
import { getServerActor } from '@/lib/auth/server-actor';
import { getDashboardSnapshot } from '@/lib/dashboard/data';
import { buildRange } from '@/lib/dashboard/date-range';
import { getActiveSavingsCard } from '@/lib/dashboard/savings-card';
import { getOnboardingState, prisma } from '@gojo/db';
import { redirect } from 'next/navigation';

import { DashboardClient } from './_components/dashboard-client';

export default async function DashboardPage() {
  const actor = await getServerActor();

  if (!actor) {
    return null;
  }

  // Cold-start guard (Story 12.2 AC1): first-login Owners are redirected into
  // the wizard. Once they "skip for now", the redirect is suppressed and a
  // persistent banner is shown instead — until coldStartCompletedAt is stamped.
  const onboarding = await getOnboardingState(actor, prisma);
  if (!onboarding.completed && !onboarding.progress.skipped) {
    redirect('/onboarding');
  }
  const showColdStartBanner = !onboarding.completed;

  const [initial, roomTypes, cancellationPolicies, savingsCard] = await Promise.all([
    getDashboardSnapshot(actor.propertyId, actor.role, buildRange('today')),
    prisma.roomType.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.cancellationPolicy.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    getActiveSavingsCard(actor.propertyId),
  ]);
  const minimumSetupComplete = roomTypes > 0 && cancellationPolicies > 0;

  const body = minimumSetupComplete ? (
    <DashboardClient
      propertyId={actor.propertyId}
      role={actor.role}
      initial={initial}
      savingsCard={savingsCard}
    />
  ) : (
    <SetupChecklistLoader propertyId={actor.propertyId} />
  );

  return (
    <>
      {showColdStartBanner ? <ColdStartBanner /> : null}
      {body}
    </>
  );
}
