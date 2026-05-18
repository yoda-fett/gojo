// @ts-nocheck
// Story 10.2f: Trial Reminders settings page — Owner-facing editor for the
// conversion-arc touchpoint schedule (10-2d's conversionArcConfig).
import { prisma } from '@gojo/db';
import { DEFAULT_CONVERSION_ARC_CONFIG } from '@gojo/types';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { getServerActor } from '@/lib/auth/server-actor';

import { TrialRemindersForm } from './form';

export const dynamic = 'force-dynamic';

export default async function TrialRemindersSettingsPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const property = await prisma.property.findFirst({
    where: { id: actor.propertyId, deletedAt: null },
    select: { id: true, conversionArcConfig: true },
  });
  if (!property) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { propertyId: actor.propertyId },
    select: { status: true },
  });

  const initialConfig =
    (property.conversionArcConfig as typeof DEFAULT_CONVERSION_ARC_CONFIG | null) ??
    DEFAULT_CONVERSION_ARC_CONFIG;

  return (
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Trial Reminders' }]}
          title="Trial Reminders"
          subtitle="Adjust when each reminder fires during your trial. Day offsets are counted from the day your trial started."
        />
      }
    >
      <TrialRemindersForm
        propertyId={property.id}
        initialConfig={initialConfig}
        subscriptionStatus={subscription?.status ?? null}
      />
    </PageShell>
  );
}
