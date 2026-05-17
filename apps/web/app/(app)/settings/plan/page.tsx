// @ts-nocheck
// Story 10.4: Plan management settings page. Loads the current subscription
// + any pending downgrade and hands off to the client form.
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { PlanManagementForm } from './form';

export const dynamic = 'force-dynamic';

export default async function PlanManagementPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const sub = await prisma.subscription.findUnique({
    where: { propertyId: actor.propertyId },
    select: {
      tier: true,
      status: true,
      billingCadence: true,
      currentPeriodEnd: true,
      pendingDowngradeTier: true,
      pendingDowngradeAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Plan management</h1>
      <p className="mt-1 text-sm text-slate-600">
        View your current plan, schedule a downgrade for the next billing cycle, or cancel a
        pending downgrade.
      </p>
      <PlanManagementForm
        propertyId={actor.propertyId}
        initial={
          sub
            ? {
                tier: sub.tier as 'TRIAL' | 'STARTER' | 'GROWTH',
                status: sub.status,
                billingCadence: (sub.billingCadence ?? 'MONTHLY') as 'MONTHLY' | 'ANNUAL',
                currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
                pendingDowngradeTier:
                  (sub.pendingDowngradeTier ?? null) as 'STARTER' | 'GROWTH' | null,
                pendingDowngradeAt: sub.pendingDowngradeAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </main>
  );
}
